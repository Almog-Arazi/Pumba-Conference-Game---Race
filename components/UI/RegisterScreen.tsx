import React, { useState } from 'react';
import { motion } from 'motion/react';

interface RegisterScreenProps {
  onSubmit: (name: string, company: string, contact: string) => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ onSubmit }) => {
  const [name, setName]       = useState('');
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [errors, setErrors]   = useState<{ name?: string; company?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!name.trim())    e.name    = 'Name is required';
    if (!company.trim()) e.company = 'Company is required';
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) { setErrors(e2); return; }
    onSubmit(name.trim(), company.trim(), contact.trim());
  };

  const inputClass = (hasError?: string) =>
    `w-full rounded-2xl px-4 py-3 text-gray-900 font-semibold text-base
     bg-white/90 border-2 outline-none transition-all duration-200
     placeholder:text-gray-400
     focus:bg-white focus:border-[#42C8BE] focus:shadow-[0_0_0_3px_rgba(66,200,190,0.25)]
     ${hasError ? 'border-red-400' : 'border-white/40'}`;

  return (
    <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden select-none pointer-events-auto">
      {/* Blurred background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/instructions-bg.jpeg')", filter: 'blur(6px)', transform: 'scale(1.08)' }}
      />
      <div className="absolute inset-0 bg-black/65" />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mb-6"
      >
        <img src="/logo_2.svg" alt="Pumba" className="w-32 md:w-44 drop-shadow-lg" />
      </motion.div>

      {/* Card */}
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        className="relative z-10 w-full max-w-sm mx-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-7 shadow-2xl"
      >
        <h2 className="text-white font-black text-2xl md:text-3xl text-center mb-1">
          Enter Your Details
        </h2>
        <p className="text-white/55 text-sm text-center mb-6">
          Your name will appear in the Hall of Fame 🏆
        </p>

        {/* Name */}
        <div className="mb-4">
          <label className="block text-white/80 font-bold text-xs mb-1.5 tracking-wide uppercase">
            Player Name <span className="text-[#42C8BE]">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setErrors(v => ({ ...v, name: undefined })); }}
            placeholder="Your name"
            className={inputClass(errors.name)}
            autoFocus
          />
          {errors.name && <p className="text-red-400 text-xs mt-1 font-semibold">{errors.name}</p>}
        </div>

        {/* Company */}
        <div className="mb-4">
          <label className="block text-white/80 font-bold text-xs mb-1.5 tracking-wide uppercase">
            Company <span className="text-[#42C8BE]">*</span>
          </label>
          <input
            type="text"
            value={company}
            onChange={e => { setCompany(e.target.value); setErrors(v => ({ ...v, company: undefined })); }}
            placeholder="Company name"
            className={inputClass(errors.company)}
          />
          {errors.company && <p className="text-red-400 text-xs mt-1 font-semibold">{errors.company}</p>}
        </div>

        {/* Phone / Email */}
        <div className="mb-6">
          <label className="block text-white/80 font-bold text-xs mb-1.5 tracking-wide uppercase">
            Phone / Email <span className="text-white/35">(optional)</span>
          </label>
          <input
            type="text"
            value={contact}
            onChange={e => setContact(e.target.value)}
            placeholder="Phone or email"
            className={inputClass()}
          />
        </div>

        <motion.button
          type="submit"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#42C8BE] to-[#2C37B2]
                     text-white font-black text-lg shadow-[0_8px_24px_rgba(66,200,190,0.4)]
                     hover:shadow-[0_8px_32px_rgba(66,200,190,0.6)] transition-shadow"
        >
          Let's Go! 🚀
        </motion.button>
      </motion.form>
    </div>
  );
};
