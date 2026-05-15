'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, BarChart3, Zap, MessageSquare, PieChart, ArrowUpRight } from 'lucide-react';

const InsightStat = ({ label, value, trend, icon: Icon, color }: any) => (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-4 rounded-2xl">
        <div className="flex justify-between items-start mb-2">
            <div className={`p-2 rounded-lg bg-${color}-500/10`}>
                <Icon className={`w-5 h-5 text-${color}-400`} />
            </div>
            {trend && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">{trend}</span>}
        </div>
        <p className="text-gray-400 text-xs font-medium">{label}</p>
        <p className="text-xl font-bold text-white mt-1">{value}</p>
    </div>
);

export default function AIInsights() {
    return (
        <section className="relative bg-[#030712] py-24 lg:py-40 overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] -mr-64 -mt-64" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] -ml-64 -mb-64" />

            <div className="container mx-auto px-6 relative z-10">
                <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
                    
                    {/* LEFT: CONTENT */}
                    <div className="w-full lg:w-1/2 space-y-8">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                        >
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
                                <Zap className="w-4 h-4 text-purple-400" />
                                <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">AI Power Insights</span>
                            </div>
                            <h2 className="text-4xl lg:text-7xl font-black text-white tracking-tighter leading-[0.9] uppercase mb-6">
                                Stop guessing. <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                                    Start knowing.
                                </span>
                            </h2>
                            <p className="text-gray-400 text-lg md:text-xl font-medium leading-relaxed max-w-xl">
                                Your AI doesn't just talk to customers—it learns from them. Get a futuristic breakdown of exactly how much money your AI is making you, which channels are winning, and when your customers are most active.
                            </p>
                        </motion.div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {[
                                { title: "Revenue Attribution", desc: "See exactly which orders were closed by AI." },
                                { title: "Channel Mastery", desc: "Compare WhatsApp vs Instagram performance." },
                                { title: "Automation Rate", desc: "Track how much work the AI handles for you." },
                                { title: "Trend Analysis", desc: "Predict your busiest hours and restock smarter." }
                            ].map((item, i) => (
                                <motion.div 
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    viewport={{ once: true }}
                                    className="flex gap-4"
                                >
                                    <div className="mt-1 bg-purple-500/20 p-1 rounded-md h-fit">
                                        <ArrowUpRight className="w-4 h-4 text-purple-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold text-base uppercase tracking-tight">{item.title}</h4>
                                        <p className="text-gray-500 text-sm">{item.desc}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT: THE DASHBOARD UI */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 40 }}
                        whileInView={{ opacity: 1, scale: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="w-full lg:w-1/2"
                    >
                        <div className="relative bg-[#0F172A] border border-white/10 rounded-[2.5rem] p-6 shadow-2xl shadow-purple-500/10 overflow-hidden">
                            {/* Glass Header */}
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                                <div>
                                    <h3 className="text-white font-black uppercase text-sm tracking-widest">AI Performance Insights</h3>
                                    <p className="text-gray-500 text-[10px]">Real-time analytics across all channels</p>
                                </div>
                                <div className="flex gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500/50" />
                                    <div className="w-2 h-2 rounded-full bg-amber-500/50" />
                                    <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <InsightStat label="AI Revenue" value="GHS 7,848" trend="+59.9%" icon={TrendingUp} color="emerald" />
                                <InsightStat label="Automation Rate" value="95.2%" trend="9/10 Chats" icon={Zap} color="purple" />
                            </div>

                            {/* Channel Breakdown Mockup */}
                            <div className="space-y-6 bg-white/5 p-6 rounded-3xl border border-white/5">
                                <h4 className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                    <PieChart className="w-4 h-4 text-pink-500" />
                                    Conversations by Channel
                                </h4>
                                
                                <div className="space-y-4">
                                    {[
                                        { label: 'webchat', val: '38%', color: 'bg-purple-500', width: 'w-[38%]' },
                                        { label: 'Instagram DM', val: '29%', color: 'bg-pink-500', width: 'w-[29%]' },
                                        { label: 'WhatsApp', val: '24%', color: 'bg-emerald-500', width: 'w-[24%]' },
                                    ].map((channel, i) => (
                                        <div key={i} className="space-y-1.5">
                                            <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400">
                                                <span>{channel.label}</span>
                                                <span className="text-white">{channel.val}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                <motion.div 
                                                    initial={{ width: 0 }}
                                                    whileInView={{ width: channel.val }}
                                                    transition={{ duration: 1, delay: 0.5 }}
                                                    className={`h-full ${channel.color}`} 
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Floating "AI Activity" Notification */}
                            <motion.div 
                                animate={{ y: [0, -10, 0] }}
                                transition={{ repeat: Infinity, duration: 4 }}
                                className="absolute -bottom-4 -right-4 bg-gradient-to-br from-purple-600 to-pink-600 p-4 rounded-2xl shadow-xl flex items-center gap-3 border border-white/20"
                            >
                                <div className="bg-white/20 p-2 rounded-lg">
                                    <MessageSquare className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-white uppercase">New AI Order</p>
                                    <p className="text-xs text-purple-100 font-bold">GHS 240 via WhatsApp</p>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>

                </div>
            </div>
        </section>
    );
}