/**
 * Trajectory.tsx - Cognitive trajectory timeline page.
 * Displays the learner's progression through verified concepts over time.
 * Route: /trajectory/:learnerId
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Loader2, BookCheck } from 'lucide-react';

interface TrajectoryEntry {
  id: string;
  concept: string;
  understanding: string;
  depth_level: number;
  source_session_id: string;
  created_at: string;
}

const DEPTH_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Recall', color: 'bg-gray-600' },
  2: { label: 'Understand', color: 'bg-blue-600' },
  3: { label: 'Apply', color: 'bg-green-600' },
  4: { label: 'Analyze', color: 'bg-purple-600' },
};

export default function Trajectory() {
  const { learnerId } = useParams<{ learnerId: string }>();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<TrajectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrajectory = async () => {
      try {
        const res = await fetch(`http://localhost:8001/api/learners/${learnerId}/trajectory`);
        if (res.ok) {
          const data = await res.json();
          setEntries(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTrajectory();
  }, [learnerId]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#1e1e1e] text-white">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1e1e1e] text-gray-100 p-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="border-b border-[#333] pb-6">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-300 text-sm flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-green-400" />
            Cognitive Trajectory
          </h1>
          <p className="text-gray-400 text-sm mt-1">Learner: {learnerId}</p>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <BookCheck className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No trajectory data yet.</p>
            <p className="text-sm mt-2">Complete learning units to build your trajectory.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-[#333]" />

            <div className="space-y-6">
              {entries.map((entry, idx) => {
                const depth = DEPTH_LABELS[entry.depth_level] || DEPTH_LABELS[2];
                const date = new Date(entry.created_at);
                const dateStr = date.toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                });

                return (
                  <div key={entry.id} className="relative flex items-start gap-4 pl-12">
                    {/* Timeline dot */}
                    <div className={`absolute left-4 top-2 w-5 h-5 rounded-full border-2 border-[#1e1e1e] ${depth.color}`} />

                    <div className="flex-1 bg-[#252526] border border-[#333] rounded-xl p-5">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-base text-gray-200">{entry.concept}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded ${depth.color} text-white`}>
                          {depth.label} (L{entry.depth_level})
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">{entry.understanding}</p>
                      <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
                        <span>{dateStr}</span>
                        <span className="font-mono">Session: {entry.source_session_id.slice(0, 8)}...</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
