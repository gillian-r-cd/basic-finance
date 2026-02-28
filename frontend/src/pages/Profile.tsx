/**
 * Profile.tsx - Learner profile page.
 * Displays the system's assessment of the learner (knowledge_level, preferences, obstacles, strengths).
 * Allows the learner to view and correct their profile via PATCH API.
 * Route: /profile/:learnerId
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Brain, AlertTriangle, Star, ArrowLeft, Save, Loader2 } from 'lucide-react';

interface ProfileData {
  knowledge_level: Record<string, string>;
  cognitive_preferences: string[];
  identified_obstacles: string[];
  strengths: string[];
}

const LEVEL_COLORS: Record<string, string> = {
  solid: 'bg-green-900/50 text-green-300 border-green-700',
  basic: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  unfamiliar: 'bg-red-900/50 text-red-300 border-red-700',
};

export default function Profile() {
  const { learnerId } = useParams<{ learnerId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingKL, setEditingKL] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`http://localhost:8001/api/learners/${learnerId}/profile`);
        if (res.ok) {
          const data = await res.json();
          const p = data.profile || {};
          setProfile({
            knowledge_level: p.knowledge_level || {},
            cognitive_preferences: p.cognitive_preferences || [],
            identified_obstacles: p.identified_obstacles || [],
            strengths: p.strengths || [],
          });
          setEditingKL(p.knowledge_level || {});
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [learnerId]);

  const handleLevelChange = (concept: string, newLevel: string) => {
    setEditingKL(prev => ({ ...prev, [concept]: newLevel }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`http://localhost:8001/api/learners/${learnerId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledge_level: editingKL }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(prev => prev ? { ...prev, knowledge_level: data.profile.knowledge_level } : prev);
        setDirty(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#1e1e1e] text-white">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const isEmpty = !profile || (
    Object.keys(profile.knowledge_level).length === 0 &&
    profile.strengths.length === 0 &&
    profile.identified_obstacles.length === 0
  );

  return (
    <div className="min-h-screen bg-[#1e1e1e] text-gray-100 p-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-[#333] pb-6">
          <div>
            <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-300 text-sm flex items-center gap-1 mb-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <User className="w-8 h-8 text-blue-400" />
              Learner Profile
            </h1>
            <p className="text-gray-400 text-sm mt-1">ID: {learnerId}</p>
          </div>
          {dirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white px-5 py-2 rounded-lg font-medium flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          )}
        </div>

        {isEmpty ? (
          <div className="text-center py-20 text-gray-500">
            <Brain className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No profile data yet.</p>
            <p className="text-sm mt-2">Start a learning session to generate your profile through diagnosis.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Knowledge Level */}
            <section className="bg-[#252526] border border-[#333] rounded-xl p-6 md:col-span-2">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-blue-400">
                <Brain className="w-5 h-5" /> Knowledge Level
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Click a level to correct the system's assessment. Changes are saved via the button above.
              </p>
              {Object.keys(editingKL).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(editingKL).map(([concept, level]) => (
                    <div key={concept} className="flex items-center justify-between p-3 bg-[#1e1e1e] rounded-lg border border-[#3c3c3c]">
                      <span className="text-sm text-gray-200">{concept}</span>
                      <div className="flex gap-2">
                        {['unfamiliar', 'basic', 'solid'].map((lv) => (
                          <button
                            key={lv}
                            onClick={() => handleLevelChange(concept, lv)}
                            className={`text-xs px-3 py-1 rounded border transition-colors ${
                              level === lv ? LEVEL_COLORS[lv] : 'border-[#555] text-gray-500 hover:text-gray-300'
                            }`}
                          >
                            {lv}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No knowledge level data available.</p>
              )}
            </section>

            {/* Strengths */}
            <section className="bg-[#252526] border border-[#333] rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-green-400">
                <Star className="w-5 h-5" /> Strengths
              </h2>
              {profile!.strengths.length > 0 ? (
                <ul className="space-y-2">
                  {profile!.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">+</span> {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 italic">Not assessed yet.</p>
              )}
            </section>

            {/* Obstacles */}
            <section className="bg-[#252526] border border-[#333] rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-5 h-5" /> Identified Obstacles
              </h2>
              {profile!.identified_obstacles.length > 0 ? (
                <ul className="space-y-2">
                  {profile!.identified_obstacles.map((o, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-amber-400 mt-0.5">!</span> {o}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 italic">None identified yet.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
