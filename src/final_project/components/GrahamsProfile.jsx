import { useState } from "react";
import "../StockAnalyzer.css";

//Importing local images
import grahamBook from "../pictures/graham_book.png";
import grahamHimself from "../pictures/graham.png";
import warrenBuffett from "../pictures/warren_buffett.png";
import grandmaMeme from "../pictures/losing_intel_meme.png";
import safety from "../pictures/safety.jpg";
import diamond from "../pictures/diamond.jpg";
import formula from "../pictures/formula.png";
import dVa from "../pictures/DefenceVsAttack.png";
import investVSpeculate from "../pictures/investVspeculate.jpg";
import whyInvest from "../pictures/why_invest.png";

function Carousel(){
    const images = [
    {
      url: warrenBuffett,
      caption: "Warren Buffett is a legendary billionaire investor and philanthropist who built his fortune at Berkshire Hathaway by faithfully applying Benjamin Graham’s value-investing principles of long-term discipline, patience, and rigorous business analysis."
    },    
    {
      url: grahamBook,
      caption: "The Intelligent Investor is essential because it equips you with a timeless, disciplined framework to master your emotions, evaluate a company's true worth, and protect your capital through a strict margin of safety. It was written by Benjamin Graham"
    },
    {
      url: grahamHimself,
      caption: "1. Having lost everything in the 1929 stock market crash, Benjamin Graham forged the discipline of value investing-proving that by relying on a strict margin of safety and true business value rather than emotional speculation, investors can tranform a volatile market form a dangerous casino into a reliable engine for secure, lon-term wealth."
    },
    {
      url: safety,
      caption: "The Margin of Safety: The central pillar of Graham's philosophy. Always buy a stock at a deep discount to its true intrinsic value so that if things go wrong, your capital is protected from catastrophic loss."
    },
    {
      url: diamond,
      caption: "Estimate the Intrinsic Value, by using either 1)   Asset-Based Valuation: looking at what the company owns (cash, real estate, etc), or    2) using its earning power/discounted cash flow (estimating how much cash the business will generate in the future and discounting it back to what its worth today"
    },
    {
      url: formula,
      caption: "Determine the margin of safety by this formula, graham generally looked to buy stocks at a 30-50% discount to their intrinsic value."
    },
    {
      url: dVa,
      caption: "Defensive vs. Enterprising Investors - Defensive ones should focus on asset allocation and low-cost index funds, while the enterprising should dedicate time to finding undervalued stocks."
    },
    {
      url: investVSpeculate,
      caption: "Investing vs Speculating - True investing requires rigorous analysis, safety of principal and reasonable returns. Speculating relies on predictions and emotional betting."
    },
    {
      url: whyInvest,
      caption: "Given you invest $500 per month for 40years, with a compounding interest of 6.3% per year, the $500 per month will grow to almost a million in 40 years time."
    },
    {
      url: grandmaMeme,
      caption: "\"History has shown that those who tried to outsmart the market usually end up worse off than those who simple stay in it.\" Your greatest enemy as an investor isn't the market itself—it's your own psychology. Success comes from remaining rational, patient, and immune to short-term market noise."
    }
  ];

  // Step 2: Use state to track the current image index (starts at 0)
  const [currentIndex, setCurrentIndex] = useState(0);

  // Step 3: Navigation functions
  const handleNext = () => {
    // If we are at the last image, loop back to the first (0), otherwise go to the next
    setCurrentIndex((prevIndex) => (prevIndex === images.length - 1 ? 0 : prevIndex + 1));
  };

  const handlePrev = () => {
    // If we are at the first image, loop to the last one, otherwise go to the previous
    setCurrentIndex((prevIndex) => (prevIndex === 0 ? images.length - 1 : prevIndex - 1));
  };

  return (
    <div className="center-container">
      <div className="carousel-card">
        <h2>Benjamin Graham</h2>
        <h3><strong>Investing 101</strong></h3>
        
        {/* Carousel Display Window */}
        <div className="carousel-display">
          <button className="carousel-btn prev-btn" onClick={handlePrev}>
            &#10094;
          </button>

          {/* Render ONE image at a time based on currentIndex */}
          <div className="carousel-slide">
            <img 
              src={images[currentIndex].url} 
              alt={images[currentIndex].caption} 
              loading="lazy"
              className="carousel-image"
            />
            <p className="carousel-caption">{images[currentIndex].caption}</p>
          </div>

          <button className="carousel-btn next-btn" onClick={handleNext}>
            &#10095;
          </button>
        </div>

        {/* Indicator dots */}
        <div className="carousel-indicators">
          {images.map((_, index) => (
            <span 
              key={index} 
              className={`dot ${index === currentIndex ? 'active-dot' : ''}`}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>
      </div>
    </div>
  );

}

export default Carousel;