'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface Kid {
  id?: number;
  name: string;
  age: number | '';
  email?: string | null;
  user_id?: string | null;
}

export default function ManageKidsForm() {
  const supabase = createClientComponentClient();

  const [kids, setKids] = useState<Kid[]>([]);
  const [newKid, setNewKid] = useState<Kid>({ name: '', age: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadKids();
  }, []);

  const loadKids = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get kids via family_relationships
      const { data: relationships, error: relError } = await supabase
        .from('family_relationships')
        .select('kid_id, child_user_id')
        .eq('parent_user_id', user.id);

      if (relError) throw relError;

      // Get kid details
      const kidIds = relationships
        ?.map(r => r.kid_id)
        .filter(Boolean) as number[];

      const childUserIds = relationships
        ?.map(r => r.child_user_id)
        .filter(Boolean) as string[];

      const { data: kidsData, error: kidsError } = await supabase
        .from('kids')
        .select('id, name, age, user_id')
        .or(`id.in.(${kidIds.join(',')}),user_id.in.(${childUserIds.map(id => `"${id}"`).join(',')})`);

      if (kidsError) throw kidsError;

      setKids(kidsData || []);
    } catch (err: any) {
      console.error('Error loading kids:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddKid = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!newKid.name || !newKid.age) {
        throw new Error('Please fill in all fields');
      }

      // Create kid record (without user_id)
      const { data: kidData, error: kidError } = await supabase
        .from('kids')
        .insert({
          name: newKid.name,
          age: newKid.age,
        })
        .select()
        .single();

      if (kidError) throw kidError;

      // Create family relationship
      const { error: relationError } = await supabase
        .from('family_relationships')
        .insert({
          parent_user_id: user.id,
          kid_id: kidData.id,
          relationship_type: 'parent-child',
        });

      if (relationError) throw relationError;

      setSuccess(`${newKid.name} added successfully!`);
      setNewKid({ name: '', age: '' });
      loadKids();
    } catch (err: any) {
      console.error('Error adding kid:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateKid = async (kidId: number, updates: Partial<Kid>) => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { error: updateError } = await supabase
        .from('kids')
        .update(updates)
        .eq('id', kidId);

      if (updateError) throw updateError;

      setSuccess('Kid updated successfully!');
      loadKids();
    } catch (err: any) {
      console.error('Error updating kid:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Manage Kids</h1>

      {/* Add New Kid Form */}
      <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
        <h2 className="text-xl font-semibold mb-4">Add a New Kid</h2>
        <form onSubmit={handleAddKid} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={newKid.name}
                onChange={(e) => setNewKid({ ...newKid, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Kid's name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Age</label>
              <input
                type="number"
                value={newKid.age}
                onChange={(e) => setNewKid({ ...newKid, age: parseInt(e.target.value) || '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Age"
                min="1"
                max="25"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? 'Adding...' : 'Add Kid'}
          </button>
        </form>
      </div>

      {/* Existing Kids List */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Your Kids</h2>

        {kids.length === 0 ? (
          <p className="text-gray-500">No kids added yet.</p>
        ) : (
          <div className="space-y-4">
            {kids.map((kid) => (
              <div key={kid.id} className="border border-gray-200 rounded-md p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input
                      type="text"
                      value={kid.name}
                      onChange={(e) => {
                        const updated = kids.map(k =>
                          k.id === kid.id ? { ...k, name: e.target.value } : k
                        );
                        setKids(updated);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Age</label>
                    <input
                      type="number"
                      value={kid.age}
                      onChange={(e) => {
                        const updated = kids.map(k =>
                          k.id === kid.id ? { ...k, age: parseInt(e.target.value) || '' } : k
                        );
                        setKids(updated);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="1"
                      max="25"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={() => handleUpdateKid(kid.id!, { name: kid.name, age: kid.age as number })}
                      disabled={saving}
                      className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400"
                    >
                      Update
                    </button>
                  </div>
                </div>

                {kid.user_id && (
                  <p className="text-xs text-gray-500 mt-2">
                    ℹ️ This kid has their own login account
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="mt-4 bg-red-50 text-red-700 p-3 rounded-md">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-4 bg-green-50 text-green-700 p-3 rounded-md">
          {success}
        </div>
      )}
    </div>
  );
}
