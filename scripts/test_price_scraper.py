import asyncio
import json
import unittest
from unittest.mock import AsyncMock, patch
from types import SimpleNamespace
from scrapling import Selector
from price_scraper import extract, scrape, scrape_iter, validate_url

URL = "https://www.nykaa.com/example/p/123"


def page(offer, **kwargs):
    product = {"@type": "Product", "offers": offer, **kwargs}
    return Selector('<script type="application/ld+json">' + json.dumps(product) + '</script>')


class Prices(unittest.TestCase):
    def test_amazon_blank_offscreen_price(self):
        html = '<div id="corePriceDisplay_desktop_feature_div"><span class="priceToPay"><span class="a-offscreen"> </span><span class="a-price-whole">2,676</span><span class="a-price-fraction">50</span></span><span class="basisPrice"><span class="a-offscreen">10,000</span></span></div><div class="a-price">999</div>'
        result = extract(Selector(html), 'https://www.amazon.in/dp/B000052YJI')
        self.assertEqual(result['selling_price'], 2676.5)
        self.assertEqual(result['mrp'], 10000)
        self.assertEqual(extract(Selector(html.replace('<span class="a-price-fraction">50</span>', '')), 'https://www.amazon.in/dp/B000052YJI')['selling_price'], 2676)

    def test_price_mrp_discount_and_stock(self):
        result = extract(page({"price": "₹1,200", "priceCurrency": "INR", "availability": "https://schema.org/InStock",
                               "priceSpecification": {"priceType": "https://schema.org/StrikethroughPrice", "price": 1500}}), URL)
        self.assertEqual(result, {"selling_price": 1200, "mrp": 1500, "discount": 20, "in_stock": True})

    def test_unknown_fields_are_not_invented(self):
        self.assertEqual(extract(page({"price": 99}), URL), {"selling_price": 99, "mrp": None, "discount": None, "in_stock": None})

    def test_out_of_stock(self):
        self.assertFalse(extract(page({"price": 99, "availability": "https://schema.org/OutOfStock"}), URL)["in_stock"])

    def test_reject_bad_prices_and_currency(self):
        for offer in ({"price": -1}, {"price": "NaN"}, {"price": True}, {"price": 10, "priceCurrency": "USD"}, {"@type": "AggregateOffer", "lowPrice": 10}):
            with self.subTest(offer=offer), self.assertRaises(ValueError):
                extract(page(offer), URL)

    def test_no_recommendation_price(self):
        html = '<script type="application/ld+json">' + json.dumps({"@type": "ItemList", "itemListElement": [{"@type": "Product", "offers": {"price": 10}}]}) + '</script>'
        with self.assertRaises(ValueError):
            extract(Selector(html), URL)

    def test_ambiguous_variants(self):
        with self.assertRaises(ValueError):
            extract(page([{"price": 99}, {"price": 199}]), URL)

    def test_graph(self):
        html = '<script type="application/ld+json">{"@graph":[{"@type":["Product"],"offers":{"price":99}}]}</script>'
        self.assertEqual(extract(Selector(html), URL)["selling_price"], 99)

    def test_metadata(self):
        html = '<meta property="product:price:amount" content="200"><meta property="product:original_price:amount" content="250">'
        self.assertEqual(extract(Selector(html), URL)["discount"], 20)

    def test_nykaa_product_state(self):
        state = {"productPage": {"product": {"id": "123", "mrp": 150, "offerPrice": 120, "inStock": True}}}
        html = '<script>window.__PRELOADED_STATE__ = ' + json.dumps(state) + ';</script>'
        self.assertEqual(extract(Selector(html), URL)["discount"], 20)

    def test_nykaa_sku_variant(self):
        # Top-level state is the default 12ml; the URL's skuId lists the 30ml.
        state = {"productPage": {"product": {"id": "123", "mrp": 2650, "offerPrice": 2650, "inStock": True, "defaultPid": "1", "variants": [
            {"childId": "1", "mrp": 2650, "offerPrice": 2650, "inStock": True},
            {"childId": "2", "mrp": 5695, "offerPrice": 5695, "inStock": False},
        ]}}}
        url = URL + "?skuId=2&se=0"
        ld = json.dumps({"@type": "Product", "offers": {"price": 5695, "url": URL}})
        html = ('<meta property="product:price:amount" content="2650"><meta property="product:original_price:amount" content="2650">'
                '<script type="application/ld+json">' + ld + '</script><script>window.__PRELOADED_STATE__ = ' + json.dumps(state) + ';</script>')
        self.assertEqual(extract(Selector(html), url), {"selling_price": 5695, "mrp": 5695, "discount": 0, "in_stock": False})
        self.assertEqual(extract(Selector(html.replace(ld, "{}")), URL)["selling_price"], 2650)
        with self.assertRaises(ValueError):
            extract(Selector(html), URL + "?skuId=9")

    def test_sold_out_without_price(self):
        self.assertEqual(extract(page({"price": "0", "availability": "https://schema.org/SoldOut"}), URL),
                         {"selling_price": None, "mrp": None, "discount": None, "in_stock": False})
        with self.assertRaises(ValueError):
            extract(page({"price": "0"}), URL)

    def test_tira_scoped_mrp(self):
        html = '<span id="item_price">936</span><span class="oldAmount--abc">1,170</span>'
        self.assertEqual(extract(Selector(html), 'https://www.tirabeauty.com/product/example')["discount"], 20)

    def test_purplle_hydration_must_agree(self):
        html = '<meta property="product:price:amount" content="339"><script>availability:$R[102]={mrp:"357",ourPrice:339,offerPrice:"339"}</script>'
        self.assertEqual(extract(Selector(html), 'https://www.purplle.com/product/example')["mrp"], 357)
        self.assertIsNone(extract(Selector(html.replace('content="339"', 'content="300"')), 'https://www.purplle.com/product/example')["mrp"])


class Requests(unittest.IsolatedAsyncioTestCase):
    async def test_fast_retailer_is_emitted_before_slow_one_finishes(self):
        release = asyncio.Event()
        async def fake_scrape(row, semaphore):
            if row['id'] == 'slow':
                await release.wait()
            return {'id': row['id'], 'ok': True}
        with patch('price_scraper.scrape_one', side_effect=fake_scrape):
            iterator = scrape_iter([{'id': 'slow'}, {'id': 'fast'}])
            first = await asyncio.wait_for(anext(iterator), timeout=1)
            self.assertEqual(first['id'], 'fast')
            release.set()
            self.assertEqual((await anext(iterator))['id'], 'slow')
            await iterator.aclose()

    async def test_private_url(self):
        for url in ('http://example.com', 'https://127.0.0.1', 'https://user:pass@example.com'):
            with self.subTest(url=url), self.assertRaises(ValueError):
                await validate_url(url)

    async def test_partial_failure_and_concurrency(self):
        active = 0
        peak = 0
        async def fetch(url, **kwargs):
            nonlocal active, peak
            active += 1
            peak = max(peak, active)
            await asyncio.sleep(0.01)
            active -= 1
            if url.endswith('bad'):
                raise TimeoutError()
            response = page({"price": 99})
            return SimpleNamespace(status=200, css=response.css)
        with patch('price_scraper.validate_url', new=AsyncMock()), patch('scrapling.fetchers.AsyncFetcher.get', side_effect=fetch):
            result = await scrape([{"id": 1, "product_url": URL}, {"id": 2, "product_url": URL + 'bad'}])
        self.assertGreater(peak, 1)
        self.assertTrue(result['results'][0]['ok'])
        self.assertEqual(result['results'][1]['reason'], 'timeout')


if __name__ == '__main__':
    unittest.main()
