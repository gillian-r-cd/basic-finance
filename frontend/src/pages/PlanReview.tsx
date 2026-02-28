import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BrainCircuit, BookOpen, Layers, CheckCircle2, ArrowRight, Network } from 'lucide-react';
import KnowledgeMapView from '../components/KnowledgeMapView';

interface PlanData {
  goal: any;
  mental_model: any;
  knowledge_map: any;
  domain: string;
  path: any[];
  rationale: string;
}

export default function PlanReview() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In MVP, we might get the plan right after generating, 
    // or we fetch it from backend. Let's mock fetching for now.
    // Ideally we would add a GET /api/plans/:plan_id endpoint that returns the JSON.
    const fetchPlan = async () => {
      try {
        const res = await fetch(`http://localhost:8001/api/plans/${planId}`);
        if (res.ok) {
          const data = await res.json();
          // Backend currently just returns {"plan_id": plan_id} in placeholder
          // Let's assume it returns full data if properly implemented
          setPlan(data.goal ? data : null);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchPlan();
  }, [planId]);

  const handleStartLearning = async () => {
    if (!plan || !plan.path || plan.path.length === 0) return;
    
    try {
      const firstUnitId = plan.path[0].unit_id;
      const res = await fetch('http://localhost:8001/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, unit_id: firstUnitId })
      });
      
      if (res.ok) {
        const data = await res.json();
        navigate(`/learn/${planId}/${data.session_id}`);
      }
    } catch (e) {
      console.error("Failed to create session:", e);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#1e1e1e] text-white">Loading Plan...</div>;

  return (
    <div className="min-h-screen bg-[#1e1e1e] text-gray-100 p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-end border-b border-[#333] pb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Your Learning Plan</h1>
            <div className="flex items-center gap-3">
              <p className="text-gray-400">Review the structure the AI has designed based on your intent.</p>
              {plan?.domain && (
                <span className="text-xs px-2 py-1 bg-cyan-900/50 text-cyan-300 rounded border border-cyan-800">
                  {plan.domain}
                </span>
              )}
            </div>
          </div>
          <button 
            onClick={handleStartLearning}
            disabled={!plan}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            Start Learning <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="grid grid-cols-3 gap-8">
          
          {/* Main Column */}
          <div className="col-span-2 space-y-6">
            <section className="bg-[#252526] border border-[#333] rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-blue-400">
                <BrainCircuit className="w-5 h-5" /> Mental Model
              </h2>
              {plan?.mental_model ? (
                <div className="space-y-4 text-sm text-gray-300">
                  <p><strong className="text-gray-200">Name:</strong> {plan.mental_model.name}</p>
                  <p><strong className="text-gray-200">Foundation:</strong> {plan.mental_model.foundation}</p>
                  <p><strong className="text-gray-200">Core Nodes:</strong> {plan.mental_model.core_nodes?.join(', ')}</p>
                </div>
              ) : (
                <div className="animate-pulse flex space-x-4">
                  <div className="flex-1 space-y-4 py-1">
                    <div className="h-2 bg-[#333] rounded w-3/4"></div>
                    <div className="space-y-2">
                      <div className="h-2 bg-[#333] rounded"></div>
                      <div className="h-2 bg-[#333] rounded w-5/6"></div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="bg-[#252526] border border-[#333] rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-green-400">
                <Layers className="w-5 h-5" /> Learning Path
              </h2>
              {plan?.path ? (
                <div className="space-y-4">
                  {plan.path.map((unit, idx) => (
                    <div key={idx} className="p-4 bg-[#1e1e1e] rounded-lg border border-[#3c3c3c]">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-lg">{idx + 1}. {unit.topic}</h3>
                        <span className="text-xs px-2 py-1 bg-[#333] rounded text-gray-300">{unit.content_role}</span>
                      </div>
                      <ul className="text-sm text-gray-400 list-disc pl-5">
                        {unit.objectives?.map((obj: string, i: number) => <li key={i}>{obj}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="h-24 bg-[#333] rounded animate-pulse"></div>
                  <div className="h-24 bg-[#333] rounded animate-pulse"></div>
                </div>
              )}
            </section>

            {/* Knowledge Map */}
            {plan?.knowledge_map && (
              <section className="bg-[#252526] border border-[#333] rounded-xl p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-cyan-400">
                  <Network className="w-5 h-5" /> Knowledge Network
                </h2>
                <p className="text-xs text-gray-500 mb-3">
                  Click nodes to see details. Blue = on learning path, yellow = contextual reference, gray = excluded from scope.
                </p>
                <KnowledgeMapView knowledgeMap={plan.knowledge_map} planPath={plan.path} />
              </section>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <section className="bg-[#252526] border border-[#333] rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-purple-400">
                <CheckCircle2 className="w-5 h-5" /> Goal
              </h2>
              {plan?.goal ? (
                <div className="text-sm text-gray-300 space-y-2">
                  <p>{plan.goal.description}</p>
                  <p className="text-xs text-gray-500 mt-2 border-t border-[#333] pt-2">Boundary: {plan.goal.boundary}</p>
                </div>
              ) : (
                <div className="h-10 bg-[#333] rounded animate-pulse"></div>
              )}
            </section>

            <section className="bg-[#252526] border border-[#333] rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-orange-400">
                <BookOpen className="w-5 h-5" /> System Rationale
              </h2>
              {plan?.rationale ? (
                <p className="text-sm text-gray-300 leading-relaxed">
                  {plan.rationale}
                </p>
              ) : (
                <div className="h-20 bg-[#333] rounded animate-pulse"></div>
              )}
            </section>
          </div>

        </div>
      </div>
    </div>
  );
}

