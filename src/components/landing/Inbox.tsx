'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Instagram, 
  Send, 
  User, 
  Zap, 
  Clock, 
  Search, 
  MoreHorizontal,
  Circle
} from 'lucide-react';

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function ChatInbox() {
  return (
    <section className="bg-[#050505] py-24 lg:py-40">
      <div className="container mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl lg:text-6xl font-black text-white tracking-tighter uppercase mb-6">
              Human handoff, <br />
              <span className="text-gray-500">Perfectly synced.</span>
            </h2>
            <p className="text-gray-400 text-lg font-medium">
              Your AI handles 95% of chats. When a customer needs a human touch, you get notified instantly. One inbox for all your social channels.
            </p>
          </motion.div>
        </div>

        {/* INBOX UI MOCKUP */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto bg-[#0A0A0A] border border-white/[0.08] rounded-[2rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col md:flex-row h-[600px]"
        >
          {/* Sidebar - Threads List */}
          <div className="w-full md:w-80 border-r border-white/[0.08] flex flex-col">
            <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
              <h3 className="text-white text-xs font-black uppercase tracking-widest">Inbox</h3>
              <Search className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex-1 overflow-y-auto">
              {[
                { name: 'Maurice', msg: 'Hi, I need help with my order.', time: '3d', active: true, channel: 'wa', status: 'Human' },
                { name: 'Customer', msg: 'That’s very kind of you, thank you!', time: '5d', channel: 'ig', status: 'AI' },
                { name: 'Ama Serwaa', msg: 'The smoked fish flavour is strong!', time: '10d', channel: 'wa', status: 'AI' },
                { name: 'Kojo Mensah', msg: 'Please which option would you like?', time: '10d', channel: 'web', status: 'Awaiting' },
              ].map((chat, i) => (
                <div key={i} className={`p-4 border-b border-white/[0.04] cursor-pointer hover:bg-white/[0.02] transition-colors ${chat.active ? 'bg-white/[0.03]' : ''}`}>
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-[10px] text-white font-bold relative`}>
                            {chat.name[0]}
                            <div className="absolute -bottom-1 -right-1 bg-[#0A0A0A] p-0.5 rounded-full">
                                {chat.channel === 'wa' && <WhatsAppIcon className="w-3 h-3 text-emerald-500" />}
                                {chat.channel === 'ig' && <Instagram className="w-3 h-3 text-pink-500" />}
                                {chat.channel === 'web' && <Circle className="w-3 h-3 text-blue-500 fill-blue-500" />}
                            </div>
                        </div>
                        <span className="text-sm font-bold text-white">{chat.name}</span>
                    </div>
                    <span className="text-[10px] text-gray-600 font-medium">{chat.time}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate pl-10">{chat.msg}</p>
                  <div className="pl-10 mt-2">
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                        chat.status === 'Human' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                        chat.status === 'AI' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' : 
                        'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>
                        {chat.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col bg-[#080808]">
            <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-black text-white uppercase tracking-widest">Maurice (WhatsApp)</span>
              </div>
              <div className="flex gap-4">
                 <Clock className="w-4 h-4 text-gray-500" />
                 <MoreHorizontal className="w-4 h-4 text-gray-500" />
              </div>
            </div>

            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                <div className="flex justify-center">
                    <span className="text-[10px] text-gray-600 uppercase font-black tracking-widest bg-white/[0.03] px-3 py-1 rounded-full">Conversation Started — March 31</span>
                </div>

                {/* AI MESSAGE */}
                <div className="flex gap-3 max-w-[80%]">
                    <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                        <Zap className="w-4 h-4 text-white" />
                    </div>
                    <div className="space-y-1">
                        <div className="bg-white/[0.05] border border-white/[0.08] p-3 rounded-2xl rounded-tl-none">
                            <p className="text-sm text-gray-300 leading-relaxed">
                                Good afternoon! 👋 Here are all the lovely shito options we have available for you today. Would you like to see the price list?
                            </p>
                        </div>
                        <span className="text-[10px] text-gray-600 font-bold uppercase">AI Assistant • 11:43 AM</span>
                    </div>
                </div>

                {/* USER MESSAGE */}
                <div className="flex gap-3 max-w-[80%] ml-auto flex-row-reverse">
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="space-y-1 items-end flex flex-col">
                        <div className="bg-[#5722c1] p-3 rounded-2xl rounded-tr-none">
                            <p className="text-sm text-white leading-relaxed">
                                Yes please, but I have a question. Do you ship to Kumasi?
                            </p>
                        </div>
                        <span className="text-[10px] text-gray-600 font-bold uppercase">Customer • 11:45 AM</span>
                    </div>
                </div>

                 {/* SYSTEM ALERT */}
                 <div className="flex justify-center">
                    <div className="bg-emerald-500/5 border border-emerald-500/10 px-4 py-2 rounded-xl flex items-center gap-3">
                        <Zap className="w-3 h-3 text-emerald-500" />
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-tight">AI Handed over to you — Shipping question detected</span>
                    </div>
                </div>
            </div>

            {/* Input Area */}
            <div className="p-4 bg-[#0A0A0A] border-t border-white/[0.08]">
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Type a message as Maurice..." 
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl py-4 pl-4 pr-12 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#5722c1] p-2 rounded-lg text-white hover:bg-purple-600 transition-colors">
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex gap-4 mt-3">
                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-1">
                        <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" /> Human Mode Active
                    </span>
                </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}