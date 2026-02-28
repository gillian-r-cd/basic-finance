import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Send, BrainCircuit, Lightbulb, FileCheck, Loader2, Network } from 'lucide-react';
import KnowledgeMapMini from '../components/KnowledgeMapMini';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { ComponentRegistry } from '../components/interactive/ComponentRegistry';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  type: 'text' | 'interactive';
  component_spec?: any;
}

interface Artifact {
  id: string;
  type: string;
  rationale: string;
}

interface SessionData {
  session: any;
  plan: any;
  learner: any;
  current_unit: any;
  history: any[];
}

export default function LearnSession() {
  const { planId, sessionId } = useParams<{ planId: string, sessionId: string }>();
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchSessionData = async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`http://localhost:8001/api/sessions/${sessionId}/details`);
      if (res.ok) {
        const data = await res.json();
        setSessionData(data);
        
        // Load history
        if (data.history && data.history.length > 0) {
           const loadedMsgs = data.history.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              type: m.message_type || 'text',
              component_spec: m.component_spec
           }));
           setMessages(loadedMsgs);
        }

        // Load persisted artifacts
        if (data.artifacts && data.artifacts.length > 0) {
          const loadedArts = data.artifacts.map((a: any) => ({
            id: a.id,
            type: a.type,
            rationale: a.rationale
          }));
          setArtifacts(loadedArts);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionData();
  }, [sessionId]);

  const handleSend = async () => {
    if (!input.trim() || !sessionId) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, type: 'text' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const asstMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: asstMsgId, role: 'assistant', content: '', thinking: '', type: 'text' }]);

    try {
      const response = await fetch(`http://localhost:8001/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userMsg.content }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      if (!reader) return;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        let currentEvent = '';
        
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.substring(7).trim();
          } else if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();
            if (!dataStr) continue;
            
            const data = JSON.parse(dataStr);
            
            if (currentEvent === 'thinking') {
              setMessages(prev => prev.map(m => 
                m.id === asstMsgId ? { ...m, thinking: (m.thinking || '') + data.message + '\n' } : m
              ));
            } else if (currentEvent === 'message_chunk') {
              setMessages(prev => prev.map(m => 
                m.id === asstMsgId ? { ...m, content: m.content + data.chunk } : m
              ));
            } else if (currentEvent === 'message_complete') {
              setMessages(prev => prev.map(m => 
                m.id === asstMsgId ? { 
                  ...m, 
                  content: data.full_content, 
                  type: data.message_type, 
                  component_spec: data.component_spec 
                } : m
              ));
              
              if (data.phase_transition) {
                 setSessionData(prev => prev ? { ...prev, session: { ...prev.session, phase: data.phase_transition } } : prev);
                 setArtifacts(prev => [...prev, { 
                   id: Date.now().toString(), 
                   type: 'phase_transition', 
                   rationale: `System automatically transitioned to ${data.phase_transition} phase.` 
                 }]);
              }
              
              if (data.unit_changed) {
                 fetchSessionData();
                 setArtifacts(prev => [...prev, { 
                   id: (Date.now() + 1).toString(), 
                   type: 'trajectory_recorded', 
                   rationale: `Learner passed verification. Trajectory recorded. Advancing to next unit.` 
                 }]);
              }
            } else if (currentEvent === 'artifact') {
              setArtifacts(prev => [...prev, { id: Date.now().toString(), type: data.type, rationale: data.rationale }]);
            } else if (currentEvent === 'error') {
               setMessages(prev => prev.map(m => 
                m.id === asstMsgId ? { ...m, content: m.content + '\n\n[Error: ' + data.detail + ']' } : m
              ));
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-[#1e1e1e] text-white">
      <Loader2 className="w-8 h-8 animate-spin" />
    </div>;
  }

  return (
    <div className="flex h-screen bg-[#1e1e1e] text-gray-100 overflow-hidden font-sans">
      {/* Left Sidebar */}
      <div className="w-64 bg-[#252526] border-r border-[#333] flex flex-col p-4 overflow-y-auto">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Learning Path</h2>
        {sessionData?.plan?.path?.map((unit: any, index: number) => {
          const isCurrent = unit.unit_id === sessionData?.current_unit?.unit_id;
          return (
            <div key={unit.unit_id} className={`flex items-center space-x-2 text-sm mb-2 p-2 rounded ${isCurrent ? 'bg-[#2d2d2d] text-blue-400' : 'text-gray-500 hover:bg-[#2d2d2d]'}`}>
              <div className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-blue-500' : 'bg-gray-600'}`}></div>
              <span>{index + 1}. {unit.topic}</span>
            </div>
          );
        })}
        
        {/* Knowledge Map Mini */}
        {sessionData?.plan?.knowledge_map && (
          <>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mt-6 mb-3 flex items-center gap-1">
              <Network className="w-3 h-3" /> Knowledge Map
            </h2>
            <KnowledgeMapMini
              knowledgeMap={sessionData.plan.knowledge_map}
              currentUnitTopic={sessionData?.current_unit?.topic}
            />
          </>
        )}

        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mt-6 mb-4">Session Info</h2>
        <div className="text-xs text-gray-300 space-y-2 p-3 bg-[#1e1e1e] rounded border border-[#333]">
          <p><strong className="text-gray-500 block mb-1">Intent:</strong> {sessionData?.plan?.intent}</p>
          {sessionData?.plan?.domain && (
            <p><strong className="text-gray-500 block mb-1">Domain:</strong> {sessionData.plan.domain}</p>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        <div className="h-14 border-b border-[#333] flex items-center px-6 shrink-0 bg-[#252526] justify-between">
          <div className="flex items-center">
            <h1 className="font-semibold text-lg flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              Unit: {sessionData?.current_unit?.topic || "Unknown Topic"}
            </h1>
            <span className="ml-4 text-xs px-2 py-1 bg-blue-900/50 text-blue-300 rounded border border-blue-800">
              {sessionData?.current_unit?.content_role || "core"}
            </span>
          </div>
          {sessionData?.session?.phase && (
            <div className={`text-xs px-3 py-1 rounded-full border ${sessionData.session.phase === 'verification' ? 'bg-purple-900/50 text-purple-300 border-purple-800' : 'bg-green-900/50 text-green-300 border-green-800'}`}>
              Phase: {sessionData.session.phase.toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <BrainCircuit className="w-16 h-16 mb-4 opacity-50" />
              <p>Start your learning session...</p>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-3xl ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-[#2d2d2d] text-gray-200'} rounded-lg p-4 shadow-md`}>
                
                {msg.role === 'assistant' && msg.thinking && (
                  <ThinkingAccordion content={msg.thinking} />
                )}
                
                <div className="prose prose-invert prose-p:leading-relaxed prose-pre:bg-[#1a1a1a] max-w-none text-[15px]">
                  {msg.content ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    isTyping && msg.role === 'assistant' && !msg.thinking && "..."
                  )}
                </div>
                
                {msg.type === 'interactive' && msg.component_spec && (
                  <div className="mt-4 border-t border-[#444] pt-4">
                    <InteractiveComponent spec={msg.component_spec} />
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-[#252526] border-t border-[#333]">
          <div className="max-w-4xl mx-auto relative flex items-center">
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask a question or share your thoughts..."
              className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg py-3 pl-4 pr-12 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button 
              onClick={handleSend}
              disabled={isTyping || !input.trim()}
              className="absolute right-2 p-2 text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Artifacts */}
      <div className="w-72 bg-[#252526] border-l border-[#333] flex flex-col p-4 overflow-y-auto">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <FileCheck className="w-4 h-4" />
          System Decisions
        </h2>
        <div className="space-y-4">
          {artifacts.length === 0 && <p className="text-xs text-gray-500">No decisions made yet.</p>}
          {artifacts.map(art => (
            <div key={art.id} className="bg-[#1e1e1e] border border-[#333] rounded p-3 text-sm shadow-sm relative overflow-hidden group">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 opacity-50"></div>
              <div className="font-semibold text-blue-400 mb-1 flex items-center gap-2 pl-2">
                <BrainCircuit className="w-3 h-3" />
                {art.type.replace('_', ' ').toUpperCase()}
              </div>
              <div className="text-gray-400 text-xs pl-2">{art.rationale}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ThinkingAccordion({ content }: { content: string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="mb-3 border border-[#3c3c3c] rounded-md bg-[#222] overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center w-full px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a] transition-colors"
      >
        {isOpen ? <ChevronDown className="w-3 h-3 mr-2" /> : <ChevronRight className="w-3 h-3 mr-2" />}
        Agent Thinking Process
      </button>
      {isOpen && (
        <div className="px-3 py-2 text-xs text-gray-500 border-t border-[#3c3c3c] whitespace-pre-wrap italic bg-[#1a1a1a]">
          {content}
        </div>
      )}
    </div>
  );
}

function InteractiveComponent({ spec }: { spec: any }) {
  const Component = ComponentRegistry[spec.component];
  if (!Component) {
    return <div className="text-red-400 italic text-sm">Failed to load interactive component: {spec.component}</div>;
  }
  
  return (
    <div>
      <Component {...spec.props} />
      {spec.instruction && (
        <p className="text-sm text-gray-400 mt-3 italic bg-blue-900/20 p-2 rounded-md border border-blue-900/50">
          💡 {spec.instruction}
        </p>
      )}
    </div>
  );
}

