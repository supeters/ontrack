'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

interface Kid {
  name: string;
  age: number | '';
}

export default function FamilyRegistrationForm() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [parentEmail, setParentEmail] = useState('');
  const [parentPassword, setParentPassword] = useState('');
  const [parentName, setParentName] = useState('');
  const [kids, setKids] = useState<Kid[]>([{ name: '', age: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'parent' | 'kids'>('parent');

  const addKid = () => {
    setKids([...kids, { name: '', age: '' }]);
  };

  const removeKid = (index: number) => {
    setKids(kids.filter((_, i) => i !== index));
  };

  const updateKid = (index: number, field: keyof Kid, value: string | number) => {
    const newKids = [...kids];
    newKids[index] = { ...newKids[index], [field]: value };
    setKids(newKids);
  };

  const handleParentRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!parentEmail || !parentPassword || !parentName) {
      setError('Please fill in all parent information');
      return;
    }

    setStep('kids');
  };

  const handleFamilySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Step 1: Sign up the parent
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: parentEmail,
        password: parentPassword,
        options: {
          data: {
            full_name: parentName,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('No user created');

      const parentUserId = authData.user.id;

      // Step 2: Create user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: parentUserId,
          full_name: parentName,
          role: 'parent',
        });

      if (profileError) throw profileError;

      // Step 3: Create kids and family relationships
      for (const kid of kids) {
        if (!kid.name || !kid.age) continue;

        // Create kid record (without user_id since they don't have login)
        const { data: kidData, error: kidError } = await supabase
          .from('kids')
          .insert({
            name: kid.name,
            age: kid.age,
          })
          .select()
          .single();

        if (kidError) throw kidError;

        // Create family relationship using kid_id
        const { error: relationError } = await supabase
          .from('family_relationships')
          .insert({
            parent_user_id: parentUserId,
            kid_id: kidData.id,
            relationship_type: 'parent-child',
          });

        if (relationError) throw relationError;
      }

      // Success! Redirect to dashboard
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Failed to register family');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Family Registration</h1>

      {step === 'parent' ? (
        <form onSubmit={handleParentRegistration} className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Parent Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input
                  type="password"
                  value={parentPassword}
                  onChange={(e) => setParentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  minLength={6}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
          >
            Next: Add Kids
          </button>
        </form>
      ) : (
        <form onSubmit={handleFamilySetup} className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Add Your Kids</h2>
            <p className="text-sm text-gray-600 mb-4">
              Kids don't need their own login - you'll manage everything for them.
            </p>

            <div className="space-y-4">
              {kids.map((kid, index) => (
                <div key={index} className="flex gap-3 items-start p-4 border border-gray-200 rounded-md">
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Name</label>
                      <input
                        type="text"
                        value={kid.name}
                        onChange={(e) => updateKid(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Age</label>
                      <input
                        type="number"
                        value={kid.age}
                        onChange={(e) => updateKid(index, 'age', parseInt(e.target.value) || '')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        min="1"
                        max="25"
                        required
                      />
                    </div>
                  </div>

                  {kids.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeKid(index)}
                      className="text-red-600 hover:text-red-800 mt-8"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addKid}
              className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              + Add Another Kid
            </button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('parent')}
              className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300"
              disabled={loading}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Creating Family...' : 'Complete Registration'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
