import React from 'react'

function AniVideo() {
  return (
    <div className="ani-video-section h-[200px] lg:h-[300px] w-full bg-[#F3EAE2]">
      <div className="ani-video-wrap h-[100%] w-[95%] sm:h-[100%] sm:w-[60%] md:h-[100%] lg:h-[100%] lg:w-[60%] mx-auto overflow-hidden">
        <video autoPlay muted loop playsInline preload="auto" className="h-full w-full object-cover">
          <source src="/animation/Create_a.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  )
}

export default AniVideo