import styles from './KnowBefore.module.css'

export default function KnowBefore() {
  return (
    <section
      aria-label="Skincare benefits"
      className="bg-[#FAF9F6] px-4 py-3 text-center sm:px-6 sm:py-6"
    >
      <div className={styles.messages}>
        <span className="sr-only">Get the best deals across brands. Products chosen for your skin. Doctor Backed.</span>
        <div className={styles.window} aria-hidden="true">
          <div className={styles.track}>
            <h2 className={styles.line}>Get the <em>BEST</em> deals across brands</h2>
            <h2 className={styles.line}><em>Products chosen for YOUR skin</em></h2>
            <h2 className={styles.line}>Doctor Backed</h2>
            <h2 className={styles.line}>Get the <em>BEST</em> deals across brands</h2>
          </div>
        </div>
      </div>
    </section>
  )
}
