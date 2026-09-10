import React, { useState, useEffect, useRef } from "react";
import {
  Volume2,
  VolumeX,
  Sparkles,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  CheckCircle2,
  BookOpen,
  Wand2,
  RefreshCw,
  Loader2,
  Sliders,
  Volume1,
  MessageCircle,
  HelpCircle,
  Sparkle,
  WifiOff,
  Wifi,
  Palette,
} from "lucide-react";
import confetti from "canvas-confetti";
import { Book, BookPage, ReaderSettings, ImageSizeOption } from "../types";
import { playGeminiAudio, playBrowserSpeech, stopCurrentAudio } from "../utils/audioPlayer";
import { getWordDetails, PhonicsWordInfo } from "../utils/phonics";
import { SafeStoryImage } from "./SafeStoryImage";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useAutoIllustrate } from "../hooks/useAutoIllustrate";

interface StoryReaderProps {
  book: Book;
  currentPageIndex: number;
  onPageChange: (newPageIndex: number) => void;
  onBackToShelf: () => void;
  onPageCompleted: (pageNumber: number) => void;
  onWordExplored: (wordInfo: PhonicsWordInfo) => void;
  onIllustrationGenerated: (pageIndex: number, newImageUrl: string, size: ImageSizeOption) => void;
  onOpenChatWithContext: (prompt: string, taskType: "general" | "complex" | "fast") => void;
  settings: ReaderSettings;
  setSettings: React.Dispatch<React.SetStateAction<ReaderSettings>>;
}

export const StoryReader: React.FC<StoryReaderProps> = ({
  book,
  currentPageIndex,
  onPageChange,
  onBackToShelf,
  onPageCompleted,
  onWordExplored,
  onIllustrationGenerated,
  onOpenChatWithContext,
  settings,
  setSettings,
}) => {
  const page: BookPage = book.pages[currentPageIndex] || book.pages[0];
  const totalPages = book.pages.length;

  // Offline / Network connectivity state
  const { isOnline } = useOnlineStatus();

  // Quietly fill in AI illustrations for any imported-book pages that don't
  // have art yet, without blocking reading (Phase 4 item 2).
  useAutoIllustrate({ book, isOnline, onIllustrationGenerated });

  // Audio / Narration state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);

  // Illustration Generation state (gemini-3-pro-image-preview)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [selectedSize, setSelectedSize] = useState<ImageSizeOption>(
    page.imageSize || "1K"
  );
  const [selectedStyle, setSelectedStyle] = useState<string>(
    "Whimsical Storybook Watercolor"
  );
  const [customDetailPrompt, setCustomDetailPrompt] = useState<string>("");
  const [showImageTools, setShowImageTools] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imageGenError, setImageGenError] = useState<string | null>(null);

  // Phonics Word Explorer Modal
  const [selectedWord, setSelectedWord] = useState<PhonicsWordInfo | null>(null);
  const [wordSoundPlaying, setWordSoundPlaying] = useState(false);

  // Page finished state
  const [pageMarkedDone, setPageMarkedDone] = useState(false);

  // Stop audio on page change or unmount
  useEffect(() => {
    stopCurrentAudio();
    setIsPlayingAudio(false);
    setActiveWordIndex(null);
    setSelectedWord(null);
    setImageGenError(null);
    setPageMarkedDone(false);
  }, [currentPageIndex, book.id]);

  // Handle TTS Read Aloud using gemini-3.1-flash-tts-preview with browser fallback
  const handleReadAloud = async () => {
    if (isPlayingAudio) {
      stopCurrentAudio();
      setIsPlayingAudio(false);
      return;
    }

    setAudioLoading(true);
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: page.text,
          voice: settings.voice,
        }),
      });

      const data = await response.json();

      if (response.ok && data.audioBase64) {
        setIsPlayingAudio(true);
        setAudioLoading(false);

        await playGeminiAudio(data.audioBase64, 24000, () => {
          setIsPlayingAudio(false);
          setActiveWordIndex(null);
        });
      } else {
        // Fallback to browser speech synthesis
        fallbackBrowserRead();
      }
    } catch (err) {
      console.warn("TTS endpoint failed, using browser speech fallback:", err);
      fallbackBrowserRead();
    }
  };

  const fallbackBrowserRead = () => {
    setAudioLoading(false);
    setIsPlayingAudio(true);

    const words = page.text.split(/\s+/);

    playBrowserSpeech(
      page.text,
      settings.voice,
      (charIndex) => {
        // approximate word index
        const textUpToChar = page.text.substring(0, charIndex);
        const wIdx = textUpToChar.trim().split(/\s+/).length - 1;
        setActiveWordIndex(Math.max(0, wIdx));
      },
      () => {
        setIsPlayingAudio(false);
        setActiveWordIndex(null);
      }
    );
  };

  // Handle generating new illustrations using gemini-3-pro-image-preview
  const handleGenerateIllustration = async () => {
    if (!isOnline) {
      setImageGenError(
        "You're currently in Offline Mode. Connect to Wi-Fi to paint new AI illustrations. Your story reading and sound-outs work completely offline!"
      );
      return;
    }

    setIsGeneratingImage(true);
    setImageGenError(null);

    const basePrompt = page.illustrationPrompt || page.text;
    const fullPrompt = customDetailPrompt
      ? `${basePrompt}. Special child request: ${customDetailPrompt}`
      : basePrompt;

    try {
      const response = await fetch("/api/generate-illustration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: fullPrompt,
          imageSize: selectedSize, // "1K" | "2K" | "4K"
          aspectRatio: "4:3",
          style: selectedStyle,
          pageNumber: page.pageNumber,
          bookTitle: book.title,
        }),
      });

      const data = await response.json();

      if (response.ok && data.imageUrl) {
        onIllustrationGenerated(currentPageIndex, data.imageUrl, selectedSize);
        // Trigger small celebration for creating an illustration
        confetti({
          particleCount: 25,
          spread: 40,
          origin: { y: 0.4 },
        });
      } else {
        setImageGenError(
          data.error || "Could not generate illustration. Please check API settings."
        );
      }
    } catch (err: any) {
      console.error("Illustration generation error:", err);
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setImageGenError("Network disconnected. Connect to Wi-Fi to paint new AI illustrations.");
      } else {
        setImageGenError(err?.message || "Failed to generate illustration. Please check connection.");
      }
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Handle word tap for phonics learning
  const handleWordClick = (rawWord: string) => {
    const clean = rawWord.replace(/[.,!?;:"'()]/g, "");
    if (!clean) return;
    const details = getWordDetails(clean);
    setSelectedWord(details);
    onWordExplored(details);

    // Speak the single word aloud
    playBrowserSpeech(details.word, settings.voice);
  };

  // Mark page complete
  const handleFinishPage = () => {
    setPageMarkedDone(true);
    onPageCompleted(page.pageNumber);

    // Trigger celebratory confetti for kid achievement
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
    });

    // If not last page, advance after brief celebratory moment
    if (currentPageIndex < totalPages - 1) {
      setTimeout(() => {
        onPageChange(currentPageIndex + 1);
      }, 900);
    }
  };

  // Font size classes
  const textSizeClass =
    settings.fontSize === "extra-large"
      ? "text-2xl sm:text-3xl leading-relaxed sm:leading-loose"
      : settings.fontSize === "large"
      ? "text-xl sm:text-2xl leading-relaxed"
      : "text-lg sm:text-xl leading-normal";

  // Font family classes
  const fontFamilyClass =
    settings.fontFamily === "fredoka"
      ? "font-display font-semibold"
      : settings.fontFamily === "dyslexic"
      ? "font-mono font-medium tracking-wide"
      : "font-sans font-medium";

  const words = page.text.split(" ");

  return (
    <div id="story-reader-container" className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
      {/* Top Breadcrumb & Page Progress Navigation */}
      <div className="flex items-center justify-between gap-3 mb-6 bg-white/80 backdrop-blur-sm p-3 rounded-2xl border border-amber-200/80 shadow-xs">
        <button
          id="reader-back-to-shelf-btn"
          onClick={onBackToShelf}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 font-bold text-xs hover:bg-amber-100 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Library</span>
        </button>

        {/* Book Title & Page Dots */}
        <div className="flex flex-col items-center">
          <h2 className="font-display font-bold text-sm sm:text-base text-amber-950 text-center truncate max-w-[200px] sm:max-w-md">
            {book.title}
          </h2>
          <div className="flex items-center gap-1.5 mt-1">
            {book.pages.map((p, idx) => (
              <button
                key={p.pageNumber}
                onClick={() => onPageChange(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === currentPageIndex
                    ? "w-6 bg-amber-500"
                    : idx < currentPageIndex
                    ? "w-2 bg-amber-300"
                    : "w-2 bg-stone-200"
                }`}
                title={`Go to page ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Page counter */}
        <div className="text-xs font-bold text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-xl">
          Page {currentPageIndex + 1} of {totalPages}
        </div>
      </div>

      {/* Main Dual Pane Reader Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT PANE: Illustration Studio (gemini-3-pro-image-preview) */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="relative rounded-3xl overflow-hidden bg-stone-900 border-4 border-white shadow-xl aspect-[4/3] group">
            {/* The page illustration with offline & ungenerated placeholder support */}
            <SafeStoryImage
              src={page.currentImageUrl || book.coverImage}
              alt={`Illustration for ${book.title} page ${page.pageNumber}`}
              title={book.title}
              author={book.author}
              category={book.category}
              prompt={page.illustrationPrompt}
              pageNumber={page.pageNumber}
              className="w-full h-full"
              imageClassName={`w-full h-full object-cover transition-opacity duration-500 ${
                isGeneratingImage ? "opacity-30 blur-xs" : "opacity-100"
              }`}
              onPaintClick={isOnline ? handleGenerateIllustration : undefined}
            />

            {/* Loading overlay for image generation */}
            {isGeneratingImage && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center bg-black/40 backdrop-blur-xs z-20">
                <div className="w-14 h-14 rounded-full bg-amber-500/80 flex items-center justify-center animate-spin mb-3">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <h4 className="font-display font-bold text-lg mb-1">
                  Painting your illustration...
                </h4>
                <p className="text-xs text-amber-200 font-medium max-w-xs">
                  Our Art Studio is painting a high-resolution ({selectedSize}) storybook illustration for this page!
                </p>
              </div>
            )}

            {/* Resolution & network indicator badges */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
              <span className="px-2.5 py-1 rounded-xl text-[11px] font-extrabold bg-black/60 text-white backdrop-blur-md border border-white/20">
                Resolution: {page.imageSize || selectedSize}
              </span>
              {!isOnline && (
                <span className="px-2.5 py-1 rounded-xl text-[11px] font-extrabold bg-amber-950/80 text-amber-200 backdrop-blur-md border border-amber-400/40 flex items-center gap-1">
                  <WifiOff className="w-3 h-3" />
                  <span>Offline</span>
                </span>
              )}
            </div>

            {/* Quick action buttons overlay */}
            <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
              <button
                id="view-fullscreen-illustration-btn"
                onClick={() => setLightboxOpen(true)}
                className="p-2 rounded-xl bg-black/60 text-white hover:bg-black/80 backdrop-blur-md transition-colors"
                title="View Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Image Error Alert */}
          {imageGenError && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
              <span>{imageGenError}</span>
              <button
                onClick={() => setImageGenError(null)}
                className="font-bold underline ml-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Illustration Studio Controls Panel (Affordance for 1K, 2K, 4K) */}
          <div className="bg-white rounded-3xl p-5 border border-amber-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-amber-600" />
                <h3 className="font-display font-bold text-sm text-amber-950">
                  AI Illustration Studio
                </h3>
              </div>
              <button
                id="toggle-custom-illustration-tools-btn"
                onClick={() => setShowImageTools(!showImageTools)}
                className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{showImageTools ? "Hide Options" : "Customize Scene"}</span>
              </button>
            </div>

            {/* Offline Guidance Callout */}
            {!isOnline && (
              <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5">
                <WifiOff className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <p className="font-extrabold text-amber-900">Offline Reading Mode Active</p>
                  <p className="text-stone-600 text-[11px] leading-relaxed">
                    Stories, voice sound-outs, and reading streak stars work completely offline! To paint new custom AI illustrations with Gemini, reconnect your device to Wi-Fi.
                  </p>
                </div>
              </div>
            )}

            {/* Primary Generation Button & Size Affordance */}
            <div className="space-y-3">
              {/* MANDATORY AFFORDANCE: Image Size (1K, 2K, 4K) */}
              <div>
                <label className="text-xs font-bold text-stone-600 mb-1.5 block">
                  Illustration Quality & Resolution:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["1K", "2K", "4K"] as ImageSizeOption[]).map((size) => (
                    <button
                      key={size}
                      id={`image-size-btn-${size}`}
                      onClick={() => setSelectedSize(size)}
                      className={`py-2 px-3 rounded-xl text-xs font-extrabold border transition-all flex flex-col items-center gap-0.5 ${
                        selectedSize === size
                          ? "bg-amber-500 text-white border-amber-600 shadow-sm shadow-amber-200"
                          : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
                      }`}
                    >
                      <span>{size}</span>
                      <span className="text-[10px] font-normal opacity-85">
                        {size === "1K" ? "Standard" : size === "2K" ? "Crisp HD" : "Ultra Sharp"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Extra customize drawer */}
              {showImageTools && (
                <div className="pt-2 border-t border-stone-100 space-y-3 animate-in fade-in">
                  {/* Style selector */}
                  <div>
                    <label className="text-xs font-bold text-stone-600 mb-1 block">
                      Art Style:
                    </label>
                    <select
                      value={selectedStyle}
                      onChange={(e) => setSelectedStyle(e.target.value)}
                      className="w-full text-xs font-medium p-2 rounded-xl border border-stone-200 bg-stone-50 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="Whimsical Storybook Watercolor">
                        Watercolor Storybook (Gentle & Warm)
                      </option>
                      <option value="3D Pixar Animation">
                        3D Animated Movie (Vibrant & Playful)
                      </option>
                      <option value="Cute Claymation">
                        Claymation (Tactile & Whimsical)
                      </option>
                      <option value="Vintage Classic Fairy Tale">
                        Classic Woodcut Fairy Tale (Detailed)
                      </option>
                      <option value="Playful Pastel Crayon Sketch">
                        Pastel & Crayon (Kid-Drawn Wonder)
                      </option>
                    </select>
                  </div>

                  {/* Custom detail prompt */}
                  <div>
                    <label className="text-xs font-bold text-stone-600 mb-1 block">
                      Add a Special Detail to the Scene:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Add purple sparkles, a funny little hat, cozy fireflies..."
                      value={customDetailPrompt}
                      onChange={(e) => setCustomDetailPrompt(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <button
                id="generate-new-illustration-btn"
                onClick={handleGenerateIllustration}
                disabled={isGeneratingImage || !isOnline}
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-extrabold text-sm transition-all shadow-md active:scale-98 ${
                  !isOnline
                    ? "bg-stone-200 text-stone-400 cursor-not-allowed shadow-none border border-stone-300"
                    : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-200 disabled:opacity-50"
                }`}
              >
                {isGeneratingImage ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Painting in {selectedSize}...</span>
                  </>
                ) : !isOnline ? (
                  <>
                    <WifiOff className="w-4 h-4 text-stone-400" />
                    <span>Connect Wi-Fi to Paint Illustration</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate New Illustration ({selectedSize})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANE: Story Text, Read Aloud, Interactive Phonics */}
        <div className="lg:col-span-6 flex flex-col justify-between min-h-[500px] bg-white rounded-3xl p-6 sm:p-8 border border-amber-200/80 shadow-sm">
          <div>
            {/* Phonics Focus Banner & Moral Tag */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {book.moral && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 text-xs font-extrabold">
                  <span>📜 Moral:</span>
                  <span className="font-medium italic text-purple-800">{book.moral}</span>
                </div>
              )}
              {page.phonicsFocus && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-bold">
                  <Sparkle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Phonics Tip: {page.phonicsFocus}</span>
                </div>
              )}
            </div>

            {/* Read Aloud Audio Controls (gemini-3.1-flash-tts-preview) */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-stone-100">
              <button
                id="read-aloud-tts-btn"
                onClick={handleReadAloud}
                disabled={audioLoading}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-extrabold text-xs transition-all shadow-sm ${
                  isPlayingAudio
                    ? "bg-rose-500 text-white shadow-rose-200"
                    : "bg-amber-500 text-white hover:bg-amber-600 shadow-amber-200"
                }`}
              >
                {audioLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Preparing Narration...</span>
                  </>
                ) : isPlayingAudio ? (
                  <>
                    <VolumeX className="w-4 h-4" />
                    <span>Pause Narration</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    <span>Read Aloud to Me</span>
                  </>
                )}
              </button>

              {/* Voice indicator / quick switcher */}
              <div className="flex items-center gap-1.5 text-xs text-stone-500 font-medium">
                <span>Voice:</span>
                <select
                  value={settings.voice}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      voice: e.target.value as "Puck" | "Kore" | "Zephyr",
                    }))
                  }
                  className="text-xs font-bold text-amber-900 bg-stone-100 py-1 px-2 rounded-lg border-0 focus:ring-1 focus:ring-amber-500"
                >
                  <option value="Puck">Puck (Cheerful)</option>
                  <option value="Kore">Kore (Warm)</option>
                  <option value="Zephyr">Zephyr (Calm)</option>
                </select>
              </div>
            </div>

            {/* Interactive Story Text */}
            <div className="mb-6">
              <div
                className={`${textSizeClass} ${fontFamilyClass} text-stone-800 leading-relaxed tracking-normal select-text`}
              >
                {words.map((rawWord, idx) => {
                  const clean = rawWord.toLowerCase().replace(/[^a-z]/g, "");
                  const isKeyWord = page.keyWords?.includes(clean);
                  const isCurrentWord = activeWordIndex === idx;

                  return (
                    <span
                      key={`${rawWord}-${idx}`}
                      onClick={() => handleWordClick(rawWord)}
                      className={`inline-block mx-1 my-0.5 px-1 rounded-lg transition-all cursor-pointer select-none ${
                        isCurrentWord
                          ? "bg-amber-400 text-amber-950 font-bold scale-105 shadow-xs"
                          : isKeyWord
                          ? "bg-amber-100/90 text-amber-900 font-semibold border-b-2 border-amber-400 hover:bg-amber-200"
                          : "hover:bg-amber-50 hover:text-amber-900"
                      }`}
                      title="Click word to sound it out!"
                    >
                      {settings.showSyllables && clean
                        ? getWordDetails(clean).syllables
                        : rawWord}
                    </span>
                  );
                })}
              </div>

              <div className="mt-4 text-[11px] text-stone-400 italic">
                💡 Tip: Tap on any word to hear how it sounds and learn what it means!
              </div>
            </div>

            {/* Quick Buddy Question Prompts for this page */}
            <div className="pt-4 border-t border-stone-100">
              <div className="text-xs font-bold text-stone-500 mb-2 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-indigo-600" />
                <span>Ask your Reading Buddy about this page:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  id="buddy-explain-page-chip"
                  onClick={() =>
                    onOpenChatWithContext(
                      `Can you explain what happens on page ${page.pageNumber} in simple words?`,
                      "general"
                    )
                  }
                  className="text-xs py-1.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-medium border border-indigo-200 transition-colors"
                >
                  💬 Explain this page
                </button>
                <button
                  id="buddy-quiz-page-chip"
                  onClick={() =>
                    onOpenChatWithContext(
                      `Give me a fun reading quiz question about page ${page.pageNumber}!`,
                      "complex"
                    )
                  }
                  className="text-xs py-1.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 font-medium border border-purple-200 transition-colors"
                >
                  ❓ Give me a fun quiz!
                </button>
                <button
                  id="buddy-soundout-page-chip"
                  onClick={() =>
                    onOpenChatWithContext(
                      `How do I sound out the word '${page.keyWords[0] || "special"}'?`,
                      "fast"
                    )
                  }
                  className="text-xs py-1.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-medium border border-amber-200 transition-colors"
                >
                  ⚡ Sound out &apos;{page.keyWords[0] || "words"}&apos;
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Page Navigation & Star Completion */}
          <div className="pt-6 border-t border-stone-100 flex items-center justify-between gap-3 mt-6">
            <button
              id="prev-page-btn"
              onClick={() => onPageChange(currentPageIndex - 1)}
              disabled={currentPageIndex === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50 disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            {/* Gamified "Finish Page" Button */}
            <button
              id="finish-page-star-btn"
              onClick={handleFinishPage}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-extrabold text-xs shadow-md transition-all active:scale-95 ${
                pageMarkedDone
                  ? "bg-emerald-500 text-white shadow-emerald-200"
                  : "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200"
              }`}
            >
              <Sparkles className="w-4 h-4 fill-current" />
              <span>{pageMarkedDone ? "Finished! +1 Star ⭐" : "I Read This Page! ⭐"}</span>
            </button>

            <button
              id="next-page-btn"
              onClick={() => onPageChange(currentPageIndex + 1)}
              disabled={currentPageIndex === totalPages - 1}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Word Phonics Explorer Popup */}
      {selectedWord && (
        <div
          id="word-explorer-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in"
        >
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-amber-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <span className="font-display font-bold text-base text-amber-950">
                  Word Explorer
                </span>
              </div>
              <button
                id="close-word-modal-btn"
                onClick={() => setSelectedWord(null)}
                className="text-stone-400 hover:text-stone-600 font-bold text-xs"
              >
                Close ✕
              </button>
            </div>

            <div className="text-center py-3">
              <div className="font-display font-extrabold text-3xl text-amber-600 tracking-wide mb-1 capitalize">
                {selectedWord.word}
              </div>
              <div className="text-sm font-bold text-stone-500 tracking-wider mb-3">
                Syllables: <span className="text-amber-800">{selectedWord.syllables}</span>
              </div>

              {/* Speak word button */}
              <button
                id="speak-single-word-btn"
                onClick={() => {
                  setWordSoundPlaying(true);
                  playBrowserSpeech(selectedWord.word, settings.voice, undefined, () =>
                    setWordSoundPlaying(false)
                  );
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-100 text-amber-900 font-bold text-xs hover:bg-amber-200 transition-colors mb-4"
              >
                <Volume1 className="w-4 h-4" />
                <span>Hear Sound Out</span>
              </button>

              <div className="p-3.5 rounded-2xl bg-amber-50/80 text-left text-xs text-stone-700 leading-relaxed mb-3">
                <div className="font-bold text-amber-950 mb-1">What it means:</div>
                <div>{selectedWord.meaning}</div>
              </div>

              {selectedWord.exampleSentence && (
                <div className="p-3 rounded-xl bg-stone-50 text-left text-xs text-stone-600 italic">
                  &ldquo;{selectedWord.exampleSentence}&rdquo;
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedWord(null)}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 transition-colors shadow-xs"
            >
              Got it! Keep Reading
            </button>
          </div>
        </div>
      )}

      {/* High-Resolution Lightbox Modal */}
      {lightboxOpen && (
        <div
          id="illustration-lightbox-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/90 backdrop-blur-md animate-in fade-in"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute -top-10 right-0 text-white text-sm font-bold bg-white/20 hover:bg-white/40 px-3 py-1 rounded-full transition-colors"
            >
              Close ✕
            </button>
            <div className="w-full max-w-2xl aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20">
              <SafeStoryImage
                src={page.currentImageUrl || book.coverImage}
                alt="Full resolution illustration"
                title={book.title}
                author={book.author}
                category={book.category}
                prompt={page.illustrationPrompt}
                pageNumber={page.pageNumber}
                size="lg"
                className="w-full h-full"
                imageClassName="w-full h-full object-contain bg-stone-950"
                onPaintClick={isOnline ? () => { setLightboxOpen(false); handleGenerateIllustration(); } : undefined}
              />
            </div>
            <div className="mt-3 text-center text-xs text-stone-300 font-medium">
              Resolution: {page.imageSize || selectedSize} • Ultra-HD Storybook Artwork
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
