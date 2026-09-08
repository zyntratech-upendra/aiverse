import React, { useState } from "react";
import SEO from "../../components/layout/SEO";
import { Mail, Phone, MapPin, Send, Loader2, CheckCircle2, MessageSquare, AlertCircle } from "lucide-react";
import { db } from "../../config/firebase";
import { collection, addDoc } from "firebase/firestore";

import { createContact } from "../../services/apiClient";

const ContactPage: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setError("Please fill out all fields.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await createContact({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });
      setSuccess(true);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (err) {
      try {
        await addDoc(collection(db, "contact_queries"), {
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
          createdAt: Date.now(),
        });
        setSuccess(true);
        setName("");
        setEmail("");
        setSubject("");
        setMessage("");
      } catch (err2) {
        console.error("Error saving contact query:", err2);
        setError("Failed to send your message. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="overflow-hidden bg-[#FAFBFC] pb-24 pt-28 min-h-screen font-sans">
      <SEO 
        title="Contact AI Verse VITB | Vishnu Institute of Technology, Bhimavaram" 
        description="Get in touch with the AI Verse VITB team at Vishnu Institute of Technology, Bhimavaram for project partnerships, event queries, and student inquiries."
        keywords="Contact AI Verse, aiversevitb, AI Verse VITB, VIT Bhimavaram, Vishnu Institute of Technology, Collaboration"
      />
      
      {/* Background glow elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] rounded-full bg-blue-50/40 blur-[100px]"></div>
        <div className="absolute bottom-[20%] right-[10%] w-[600px] h-[600px] rounded-full bg-sky-50/50 blur-[120px]"></div>
      </div>

      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-[#2563EB] text-[10px] font-bold tracking-widest uppercase">
            <MessageSquare className="w-3.5 h-3.5" />
            Connect With Us
          </span>
          <h1 className="text-4xl md:text-5xl font-serif font-semibold text-slate-900 tracking-tight">
            Let's Start a Conversation
          </h1>
          <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
            Have questions about upcoming hackathons, research collaborations, or membership? Drop us a line and our coordinators will reach out.
          </p>
        </div>

        {/* Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Left Column: Contact Cards */}
          <div className="lg:col-span-5 space-y-6 text-left">
            <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
              Contact Information
            </h2>
            
            <div className="space-y-4">
              {/* Lab Location */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100/80 shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0 border border-blue-100/35">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Research Hub</h4>
                  <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                    AI Innovation Lab, Room 402, Block III<br />
                    Vishnu Institute of Technology
                  </p>
                </div>
              </div>

              {/* Email Address */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100/80 shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0 border border-rose-100/30">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Inquiry</h4>
                  <p className="text-sm font-semibold text-slate-700">
                    <a href="mailto:coordination@ai-verse.org" className="hover:text-[#2563EB] transition-colors">
                      coordination@ai-verse.org
                    </a>
                  </p>
                </div>
              </div>

              {/* Phone Line */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100/80 shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0 border border-amber-100/30">
                  <Phone className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Coordinator Helpline</h4>
                  <p className="text-sm font-semibold text-slate-700">
                    +1 (555) 234-5678
                  </p>
                </div>
              </div>
            </div>

            {/* Premium Decorative Map Graphic Box */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 relative overflow-hidden aspect-[4/3] flex flex-col justify-between border border-slate-800 shadow-inner">
              <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:16px_16px]"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.25)_0%,transparent_70%)] pointer-events-none transform-gpu" />
              
              <div className="relative z-10 flex justify-between items-start">
                <span className="text-[10px] font-mono tracking-widest text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                  LAT: 16.5672° N
                </span>
                <span className="text-[10px] font-mono tracking-widest text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                  LON: 81.5208° E
                </span>
              </div>
              
              <div className="relative z-10 space-y-1.5">
                <h4 className="text-sm font-extrabold text-white tracking-tight">Vishnu Hub Campus</h4>
                <p className="text-[11px] text-slate-400 font-medium">
                  Drop by our interactive station for hardware demonstrations or sandbox experimentation.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Contact Form Card */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-slate-100 rounded-[32px] p-6 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.015)] text-left">
              <h3 className="text-xl font-extrabold text-slate-800 tracking-tight mb-6">
                Send Us a Message
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Error Banner */}
                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-xs font-semibold">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Success Banner */}
                {success && (
                  <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col items-center text-center gap-2 text-emerald-600 text-xs font-semibold animate-in fade-in duration-200">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
                    <h4 className="text-sm font-bold text-slate-800">Message Sent Successfully!</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium max-w-sm">
                      Thank you for reaching out. We have logged your query, and our student organizer coordination desk will reply to you shortly.
                    </p>
                    <button 
                      type="button" 
                      onClick={() => setSuccess(false)}
                      className="mt-2 text-xs font-bold text-[#2563EB] hover:underline"
                    >
                      Send another message
                    </button>
                  </div>
                )}

                {!success && (
                  <>
                    {/* Name */}
                    <div className="space-y-1.5">
                      <label htmlFor="contact-name" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Your Name</label>
                      <input 
                        id="contact-name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Satoshi Nakamoto"
                        className="w-full bg-[#FAFBFC] text-slate-800 placeholder-slate-400 text-sm px-4 py-3 rounded-xl border border-slate-200/80 outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-50/50 transition-all duration-300 font-medium"
                      />
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label htmlFor="contact-email" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                      <input 
                        id="contact-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. satoshi@bitcoin.org"
                        className="w-full bg-[#FAFBFC] text-slate-800 placeholder-slate-400 text-sm px-4 py-3 rounded-xl border border-slate-200/80 outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-50/50 transition-all duration-300 font-medium"
                      />
                    </div>

                    {/* Subject */}
                    <div className="space-y-1.5">
                      <label htmlFor="contact-subject" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subject</label>
                      <input 
                        id="contact-subject"
                        name="subject"
                        type="text"
                        required
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="e.g. Collaboration on LLM Project"
                        className="w-full bg-[#FAFBFC] text-slate-800 placeholder-slate-400 text-sm px-4 py-3 rounded-xl border border-slate-200/80 outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-50/50 transition-all duration-300 font-medium"
                      />
                    </div>

                    {/* Message */}
                    <div className="space-y-1.5">
                      <label htmlFor="contact-message" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Message</label>
                      <textarea 
                        id="contact-message"
                        name="message"
                        rows={4}
                        required
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="How can we help you?"
                        className="w-full bg-[#FAFBFC] text-slate-800 placeholder-slate-400 text-sm px-4 py-3 rounded-xl border border-slate-200/80 outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-50/50 transition-all duration-300 font-medium resize-none leading-relaxed"
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-[#2563EB] hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/10 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed select-none text-sm"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Send Message
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ContactPage;
