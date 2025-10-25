'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

export default function CreditsOverviewCard() {
  const [credits, setCredits] = useState<{
    percentage: number;
    credits: number;
    maxCredits: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCredits = useCallback(async () => {
    try {
      const response = await fetch('/api/credits');
      if (response.ok) {
        const data = await response.json();
        setCredits({
          percentage: data.percentage,
          credits: data.credits,
          maxCredits: data.maxCredits,
        });
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredits();
    const interval = setInterval(fetchCredits, 30000);
    return () => clearInterval(interval);
  }, [fetchCredits]);

  const getCreditColor = (percentage: number) => {
    if (percentage <= 10) return 'text-red-400';
    if (percentage <= 20) return 'text-yellow-400';
    return 'text-white';
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage <= 10) return 'bg-red-500';
    if (percentage <= 20) return 'bg-yellow-500';
    return 'bg-white';
  };

  const getStatusText = (percentage: number) => {
    if (percentage <= 10) return 'Critical - Low Credits';
    if (percentage <= 20) return 'Warning - Running Low';
    return 'Active';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full mt-6"
    >
      <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-xl md:rounded-2xl p-4 md:p-6 hover:border-white/[0.12] transition-all duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base md:text-lg font-semibold text-white mb-1">Credits Overview</h3>
            <p className="text-xs md:text-sm text-gray-400">Your current usage and balance</p>
          </div>
          {!isLoading && credits && (
            <div className={`px-2.5 md:px-3 py-1.5 rounded-lg text-[11px] md:text-xs font-medium self-start sm:self-auto ${
              credits.percentage <= 10 
                ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                : credits.percentage <= 20 
                ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' 
                : 'bg-white/10 text-white border border-white/20'
            }`}>
              {getStatusText(credits.percentage)}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-6 md:py-8">
            <div className="animate-spin rounded-full h-6 w-6 md:h-8 md:w-8 border-2 border-blue-500 border-t-transparent"></div>
          </div>
        ) : credits ? (
          <div className="space-y-3 md:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
              <div className="flex items-baseline gap-1.5 md:gap-2">
                <span className={`text-3xl md:text-4xl font-bold ${getCreditColor(credits.percentage)}`}>
                  {credits.credits}
                </span>
                <span className="text-sm md:text-lg text-gray-400">/ {credits.maxCredits} credits</span>
              </div>
              <div className={`text-xl md:text-2xl font-semibold ${getCreditColor(credits.percentage)}`}>
                {credits.percentage}%
              </div>
            </div>

            <div className="relative w-full h-2.5 md:h-3 bg-white/[0.05] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${credits.percentage}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`absolute top-0 left-0 h-full ${getProgressBarColor(credits.percentage)} rounded-full`}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 md:gap-4 pt-2">
              <div className="bg-white/[0.02] rounded-lg p-2 md:p-3 border border-white/[0.05]">
                <p className="text-[10px] md:text-xs text-gray-400 mb-0.5 md:mb-1">Available</p>
                <p className="text-base md:text-lg font-semibold text-white">{credits.credits}</p>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-2 md:p-3 border border-white/[0.05]">
                <p className="text-[10px] md:text-xs text-gray-400 mb-0.5 md:mb-1">Used</p>
                <p className="text-base md:text-lg font-semibold text-white">{credits.maxCredits - credits.credits}</p>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-2 md:p-3 border border-white/[0.05]">
                <p className="text-[10px] md:text-xs text-gray-400 mb-0.5 md:mb-1">Total</p>
                <p className="text-base md:text-lg font-semibold text-white">{credits.maxCredits}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.05]">
              <p className="text-[10px] md:text-xs text-gray-400 leading-relaxed">
                1 credit = 1 minute of browser automation • Credits deducted only for completed sessions and manual stops
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            Failed to load credits information
          </div>
        )}
      </div>
    </motion.div>
  );
}
