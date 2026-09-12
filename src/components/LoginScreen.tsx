import React, { useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";

interface LoginScreenProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, displayName: string, password: string) => Promise<void>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onRegister }) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await onLogin(email.trim(), password);
      } else {
        await onRegister(email.trim(), displayName.trim(), password);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-sky-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border-4 border-amber-200 p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-amber-400 rounded-full p-3 mb-3">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">StoryPals</h1>
          <p className="text-gray-500 text-sm mt-1">
            {mode === "login" ? "Welcome back! Log in to continue." : "Create a parent account to get started."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="displayName">
                Your name
              </label>
              <input
                id="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="Jamie Rivera"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="At least 8 characters"
            />
          </div>

          {errorMessage && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold rounded-xl py-2.5 transition-colors"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">
          {mode === "login" ? (
            <>
              New to StoryPals?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setErrorMessage(null);
                }}
                className="text-amber-600 font-medium hover:underline"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setErrorMessage(null);
                }}
                className="text-amber-600 font-medium hover:underline"
              >
                Log in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};
