import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Sparkles, Loader2 } from 'lucide-react';

export default function Home() {
  const [intent, setIntent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const navigate = useNavigate();

  const handleGenerate = async () => {
    if (!intent.trim()) return;
    setIsGenerating(true);
    setStatusMsg('Initializing planner...');

    try {
      // Mock learner ID for MVP
      const learnerId = 'user_' + Math.random().toString(36).substring(7);

      const response = await fetch('http://localhost:8001/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learner_id: learnerId, intent: intent }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      if (!reader) throw new Error('No reader available');

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventName = line.substring(7).trim();
            if (eventName === 'error') {
               setStatusMsg('Error occurred during generation.');
               setIsGenerating(false);
               return;
            }
          } else if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();
            if (!dataStr) continue;
            
            const data = JSON.parse(dataStr);
            
            if (data.stage) {
              setStatusMsg(data.message || 'Processing...');
            } else if (data.plan_id) {
              // Successfully generated plan
              setStatusMsg('Plan ready!');
              // Wait a bit then redirect
              setTimeout(() => {
                navigate(`/plan/${data.plan_id}`);
              }, 1000);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setStatusMsg('Generation failed. Please try again.');
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#1e1e1e] text-gray-100 p-6">
      <div className="max-w-2xl w-full flex flex-col items-center space-y-8">
        <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/50">
          <Target className="w-10 h-10 text-white" />
        </div>
        
        <h1 className="text-4xl font-bold text-center tracking-tight">What do you want to learn?</h1>
        <p className="text-gray-400 text-center text-lg max-w-lg">
          Describe your learning goals, current level, or just what you're curious about. The AI will construct a targeted mental model and learning path for you.
        </p>

        <div className="w-full relative">
          <textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            disabled={isGenerating}
            placeholder="e.g. I want to understand how compound interest and risk work in personal investing. I'm a total beginner..."
            className="w-full h-40 bg-[#252526] border border-[#3c3c3c] rounded-xl p-5 text-lg focus:outline-none focus:border-blue-500 transition-colors resize-none disabled:opacity-50"
          />
          
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !intent.trim()}
            className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:text-blue-300 text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Learning Plan
              </>
            )}
          </button>
        </div>

        {isGenerating && (
          <div className="text-blue-400 text-sm font-medium animate-pulse flex items-center gap-2">
             <Loader2 className="w-4 h-4 animate-spin" />
             {statusMsg}
          </div>
        )}
      </div>
    </div>
  );
}

