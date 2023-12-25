import { useState, useEffect } from "preact/hooks";
import "./Icebreaker.css";

interface IcebreakerProps {
  onTimerComplete: () => void;
  duration: number;
  header: string;
  options?: string[];
  selectedAnswerCallback?: (answer: string) => void;
}

const Icebreaker = ({
  onTimerComplete,
  duration,
  header,
  options,
  selectedAnswerCallback,
}: IcebreakerProps) => {
  const [showTimer, setShowTimer] = useState(false);
  const [startCountdown, setStartCountdown] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(duration / 1000));

  useEffect(() => {
    let interval: number;
    if (startCountdown) {
      interval = window.setInterval(() => {
        setSecondsLeft((seconds) => {
          if (seconds > 1) return seconds - 1;
          clearInterval(interval);
          return 0;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [startCountdown]);

  useEffect(() => {
    // Fade in the timer after a delay
    const timerFadeInTimeout = setTimeout(() => {
      setShowTimer(true);
      // Start countdown after fade-in is complete
      setTimeout(() => {
        setStartCountdown(true);
        // Fade out the timer after countdown
        setTimeout(() => {
          setShowTimer(false);
          onTimerComplete();
        }, duration);
      }, 500); // Corresponds to fade-in duration
    }, 1500); // Delay before showing the timer

    return () => clearTimeout(timerFadeInTimeout);
  }, [onTimerComplete, duration]);

  return (
    <div className="icebreaker">
      <div className="animated-text">{header}</div>
      <div className={`options ${showTimer ? "show" : ""}`}>
        {options?.map((option) => (
          <div
            className="option"
            onClick={() => selectedAnswerCallback?.(option)}
          >
            {option}
          </div>
        ))}
      </div>

      <div className={`timer-wrapper ${showTimer ? "show" : ""}`}>
        {startCountdown && (
          <>
            <svg className="circular-timer" viewBox="0 0 100 100">
              <circle
                className="timer-path"
                cx="50"
                cy="50"
                r="45"
                style={{
                  animation: `countdown ${duration / 1000}s linear forwards`,
                }}
              ></circle>
            </svg>
            <div className="countdown-text">{secondsLeft}</div>
          </>
        )}
      </div>
    </div>
  );
};

export default Icebreaker;
