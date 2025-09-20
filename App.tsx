
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PlaybackState } from './types';
import { Icon } from './components/Icon';

const DEFAULT_TEXT = `This is an example of the text-to-speech application.
Each line will be read out loud.
After a line is spoken, there will be a 10-second pause before the next one begins.
You can use the controls to play, pause, or stop the narration at any time.
Feel free to replace this text with your own content.`;

const DELAY_SECONDS = 10;

const App: React.FC = () => {
  const [text, setText] = useState<string>(DEFAULT_TEXT);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(DELAY_SECONDS);
  
  const linesRef = useRef<string[]>([]);
  // Fix: Replaced NodeJS.Timeout with ReturnType<typeof setTimeout> for browser compatibility.
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Fix: Replaced NodeJS.Timeout with ReturnType<typeof setInterval> for browser compatibility.
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedFromStateRef = useRef<PlaybackState | null>(null);

  const speech = window.speechSynthesis;

  const cleanUpTimers = useCallback(() => {
    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Functions are reordered to fix initialization error.
  // `startDelay` is defined here, but it depends on `speakLine`.
  // `speakLine` is defined next, and it depends on `startDelay`.
  // To break the circular dependency for initialization, we declare them in an order
  // that allows the dependency to be resolved.
  
  // We define speakLine first, but it will need startDelay.
  // We define startDelay, but it will need speakLine.
  // The solution is to reorder them so the dependency is available.
  
  let speakLine: (lineIndex: number) => void;

  const startDelay = useCallback(() => {
    cleanUpTimers();
    setPlaybackState(PlaybackState.WAITING);
    setCountdown(DELAY_SECONDS);

    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);

    delayTimerRef.current = setTimeout(() => {
      cleanUpTimers();
      setCurrentLineIndex(prev => {
          const nextIndex = prev + 1;
          speakLine(nextIndex);
          return nextIndex;
      });
    }, DELAY_SECONDS * 1000);
  }, [cleanUpTimers, setPlaybackState, setCountdown, setCurrentLineIndex]);

  speakLine = useCallback((lineIndex: number) => {
    if (lineIndex >= linesRef.current.length) {
      setPlaybackState(PlaybackState.FINISHED);
      return;
    }

    const lineToSpeak = linesRef.current[lineIndex];
    if (!lineToSpeak) { // Handle empty lines
        startDelay();
        return;
    }

    const utterance = new SpeechSynthesisUtterance(lineToSpeak);
    utterance.onstart = () => {
        setPlaybackState(PlaybackState.SPEAKING);
        setCurrentLineIndex(lineIndex);
    };
    utterance.onend = () => {
      if(lineIndex < linesRef.current.length -1) {
        startDelay();
      } else {
        setPlaybackState(PlaybackState.FINISHED);
      }
    };
    utterance.onerror = () => {
      console.error("Speech synthesis error");
      setPlaybackState(PlaybackState.IDLE);
    };

    speech.speak(utterance);
  }, [speech, startDelay, setPlaybackState, setCurrentLineIndex]);


  const handlePlayPause = () => {
    if (playbackState === PlaybackState.IDLE || playbackState === PlaybackState.FINISHED) {
      linesRef.current = text.split('\n').filter(line => line.trim() !== '');
      if (linesRef.current.length > 0) {
        setCurrentLineIndex(0);
        speakLine(0);
      }
    } else if (playbackState === PlaybackState.SPEAKING || playbackState === PlaybackState.WAITING) {
      pausedFromStateRef.current = playbackState;
      cleanUpTimers();
      speech.pause();
      setPlaybackState(PlaybackState.PAUSED);
    } else if (playbackState === PlaybackState.PAUSED) {
      if (pausedFromStateRef.current === PlaybackState.WAITING) {
        startDelay();
      } else {
        speech.resume();
        setPlaybackState(PlaybackState.SPEAKING);
      }
      pausedFromStateRef.current = null;
    }
  };

  const handleStop = () => {
    cleanUpTimers();
    speech.cancel();
    setPlaybackState(PlaybackState.IDLE);
    setCurrentLineIndex(0);
    setCountdown(DELAY_SECONDS);
  };
  
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      speech.cancel();
      cleanUpTimers();
    };
  }, [speech, cleanUpTimers]);

  const getStatusMessage = () => {
    switch (playbackState) {
      case PlaybackState.IDLE:
        return { message: "Ready to speak", icon: <Icon name="microphone" className="w-5 h-5 text-gray-400" /> };
      case PlaybackState.SPEAKING:
        return { message: "Speaking...", icon: <Icon name="microphone" className="w-5 h-5 text-blue-400 animate-pulse" /> };
      case PlaybackState.PAUSED:
        return { message: "Paused", icon: <Icon name="pause" className="w-5 h-5 text-yellow-400" /> };
      case PlaybackState.WAITING:
        return { message: `Waiting for ${countdown}s...`, icon: <Icon name="timer" className="w-5 h-5 text-teal-400 animate-spin" style={{animationDuration: '3s'}} /> };
      case PlaybackState.FINISHED:
        return { message: "Finished", icon: <Icon name="microphone" className="w-5 h-5 text-green-400" /> };
      default:
        return { message: "...", icon: <Icon name="microphone" className="w-5 h-5 text-gray-400" /> };
    }
  };
  const { message, icon } = getStatusMessage();

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-5xl mx-auto animate-fade-in">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300 animate-text-focus-in">
            Delayed Text to Speech
          </h1>
          <p className="text-gray-400 mt-2 text-lg">Read text aloud with a 10-second pause between each line.</p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-gray-800/50 p-6 rounded-2xl shadow-2xl border border-gray-700/50">
            <label htmlFor="text-input" className="flex items-center text-lg font-semibold text-gray-300 mb-3">
              <Icon name="text" className="w-6 h-6 mr-3 text-blue-400" />
              Your Text
            </label>
            <textarea
              id="text-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={playbackState !== PlaybackState.IDLE && playbackState !== PlaybackState.FINISHED}
              className="w-full h-96 bg-gray-900/70 border border-gray-600 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 resize-none placeholder-gray-500 disabled:opacity-50"
              placeholder="Enter text here..."
            />
          </div>

          <div className="flex flex-col space-y-8">
            <div className="bg-gray-800/50 p-6 rounded-2xl shadow-2xl border border-gray-700/50">
              <h2 className="text-lg font-semibold text-gray-300 mb-4">Controls</h2>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 p-3 bg-gray-900/60 rounded-lg">
                  {icon}
                  <span className="font-mono text-sm">{message}</span>
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={handlePlayPause}
                    disabled={!text.trim()}
                    className="flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full text-white shadow-lg hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500/50"
                    aria-label={playbackState === PlaybackState.SPEAKING || playbackState === PlaybackState.WAITING ? 'Pause' : 'Play'}
                  >
                    <Icon name={playbackState === PlaybackState.SPEAKING || playbackState === PlaybackState.WAITING ? 'pause' : 'play'} className="w-8 h-8" />
                  </button>
                  <button
                    onClick={handleStop}
                    disabled={playbackState === PlaybackState.IDLE}
                    className="flex items-center justify-center w-16 h-16 bg-red-600 rounded-full text-white shadow-lg hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-red-500/50"
                    aria-label="Stop"
                  >
                    <Icon name="stop" className="w-8 h-8" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-grow bg-gray-800/50 p-6 rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden">
              <h2 className="text-lg font-semibold text-gray-300 mb-4">Transcript</h2>
              <div className="h-72 overflow-y-auto space-y-2 pr-2">
                {text.split('\n').map((line, index) => (
                  <p
                    key={index}
                    className={`p-3 rounded-md transition-all duration-300 ${
                      (playbackState === PlaybackState.SPEAKING || playbackState === PlaybackState.WAITING) && index === currentLineIndex
                        ? 'bg-blue-500/30 text-white font-semibold'
                        : 'bg-gray-900/50 text-gray-300'
                    }`}
                  >
                    {line || <span className="text-gray-500 italic">Empty line</span>}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
