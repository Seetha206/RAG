import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { FAQEntry, FAQCategoryData } from '../../types/faq.types';

interface FAQAnswerModalProps {
  faq: FAQEntry;
  category: FAQCategoryData;
  onClose: () => void;
}

export function FAQAnswerModal({ faq, category, onClose }: FAQAnswerModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.9, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 30, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg glass-card rounded-2xl shadow-2xl overflow-hidden border border-white/10"
        >
          {/* Header */}
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ backgroundColor: `${category.color}18` }}
          >
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: category.color }}
            >
              {category.name}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <h3 className="text-lg font-bold text-white mb-4 leading-snug">
              {faq.question}
            </h3>
            <p className="text-slate-300 leading-relaxed text-sm">
              {faq.answer}
            </p>
          </div>

          {/* Footer */}
          {faq.source_file && (
            <div className="px-6 py-3 bg-white/5 border-t border-white/10">
              <p className="text-xs text-slate-500">
                Source: {faq.source_file}
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
