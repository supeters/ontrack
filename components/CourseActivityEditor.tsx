'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Plus, GripVertical, Trash2, ChevronRight, ChevronDown, Calendar } from 'lucide-react';

interface CourseActivityEditorProps {
  courseId: number;
  kidId: number;
  onUpdate?: () => void;
}

interface Activity {
  id: number;
  title: string;
  activity_type: string;
  plan_date: string | null;
  position: number;
  parent_activity_id: number | null;
  module_id: number | null;
  resource_url: string | null;
  estimated_minutes: number | null;
  children?: Activity[];
}

export default function CourseActivityEditor({ courseId, kidId, onUpdate }: CourseActivityEditorProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [modules, setModules] = useState<Activity[]>([]);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  // New item states
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [newActivityDate, setNewActivityDate] = useState('');
  const [newActivityType, setNewActivityType] = useState('assignment');
  const [newActivityUrl, setNewActivityUrl] = useState('');
  const [newActivityEstimatedMinutes, setNewActivityEstimatedMinutes] = useState('');

  const loadActivities = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/activities?course_id=${courseId}&kid_id=${kidId}`);
      const data = await response.json();

      // Build hierarchy
      const moduleMap = new Map<number, Activity>();
      const rootModules: Activity[] = [];

      // First pass: create modules
      data
        .filter((a: Activity) => a.activity_type && a.activity_type.toLowerCase() === 'module')
        .sort((a: Activity, b: Activity) => a.position - b.position)
        .forEach((module: Activity) => {
          moduleMap.set(module.id, { ...module, children: [] });
          rootModules.push(moduleMap.get(module.id)!);
        });

      // Second pass: add children to modules
      data
        .filter((a: Activity) => a.activity_type && a.activity_type.toLowerCase() !== 'module' && a.module_id)
        .sort((a: Activity, b: Activity) => a.position - b.position)
        .forEach((activity: Activity) => {
          const module = moduleMap.get(activity.module_id!);
          if (module) {
            module.children!.push(activity);
          }
        });

      setModules(rootModules);
      setLoading(false);
    } catch (error) {
      console.error('Error loading activities:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [courseId, kidId]);

  const toggleModule = (moduleId: number) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const handleAddModule = async () => {
    if (!newModuleTitle.trim()) return;

    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          kidId,
          title: newModuleTitle,
          activityType: 'module',
          position: modules.length + 1,
          isActionable: false
        }),
      });

      if (response.ok) {
        setNewModuleTitle('');
        await loadActivities();
      }
    } catch (error) {
      console.error('Error creating module:', error);
    }
  };

  const handleAddActivity = async () => {
    if (!newActivityTitle.trim() || !selectedModuleId) return;

    try {
      const module = modules.find(m => m.id === selectedModuleId);
      const position = module?.children?.length || 0;

      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          kidId,
          title: newActivityTitle,
          activityType: newActivityType,
          parentActivityId: selectedModuleId,
          moduleId: selectedModuleId,
          position,
          planDate: newActivityDate || null,
          resourceUrl: newActivityUrl || null,
          estimatedMinutes: newActivityEstimatedMinutes ? parseInt(newActivityEstimatedMinutes) : null,
          isActionable: true
        }),
      });

      if (response.ok) {
        setNewActivityTitle('');
        setNewActivityDate('');
        setNewActivityType('assignment');
        setNewActivityUrl('');
        setNewActivityEstimatedMinutes('');
        await loadActivities();
      }
    } catch (error) {
      console.error('Error creating activity:', error);
    }
  };

  const handleUpdatePlanDate = async (activityId: number, planDate: string) => {
    try {
      await fetch(`/api/activities`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId, updates: { plan_date: planDate || null } }),
      });
      await loadActivities();
    } catch (error) {
      console.error('Error updating plan date:', error);
    }
  };


  const handleUpdateResourceUrl = async (activityId: number, resourceUrl: string) => {
    try {
      await fetch(`/api/activities`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId, updates: { resource_url: resourceUrl || null } }),
      });
      await loadActivities();
    } catch (error) {
      console.error('Error updating resource URL:', error);
    }
  };

  const handleUpdateEstimatedMinutes = async (activityId: number, estimatedMinutes: string) => {
    try {
      await fetch(`/api/activities`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          activityId, 
          updates: { estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes) : null } 
        }),
      });
      await loadActivities();
    } catch (error) {
      console.error('Error updating estimated minutes:', error);
    }
  };

  const handleUpdateActivityType = async (activityId: number, activityType: string) => {
    try {
      await fetch(`/api/activities`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId, updates: { activity_type: activityType } }),
      });
      await loadActivities();
    } catch (error) {
      console.error('Error updating activity type:', error);
    }
  };
  const handleDeleteActivity = async (activityId: number) => {
    if (!confirm('Are you sure you want to delete this activity?')) return;

    try {
      await fetch(`/api/activities?id=${activityId}`, {
        method: 'DELETE',
      });
      await loadActivities();
    } catch (error) {
      console.error('Error deleting activity:', error);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${c.text}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current" />
      </div>
    );
  }

  return (
    <div className={`${c.bg} ${c.text} space-y-4`}>
      {/* Add Module Section */}
      <div className={`${c.cardBg} border ${c.moduleBorder} rounded-lg p-4`}>
        <h3 className={`text-sm font-bold ${c.moduleText} mb-3`}>Add Module</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddModule()}
            placeholder="Module title..."
            className={`flex-1 px-3 py-2 text-sm border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
          />
          <button
            onClick={handleAddModule}
            className={`px-4 py-2 ${c.checkboxChecked} text-white rounded-lg hover:opacity-90 text-sm font-medium`}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Activities Table */}
      <div className={`${c.cardBg} border ${c.moduleBorder} rounded-lg overflow-hidden`}>
        <div className={`${c.workgroupBg} px-4 py-3 border-b ${c.divider}`}>
          <div className="grid grid-cols-12 gap-2 text-xs font-semibold uppercase tracking-wider">
            <div className="col-span-3">Activity</div>
            <div className="col-span-2">Plan Date</div>
            <div className="col-span-2">Resource URL</div>
            <div className="col-span-1">Est. Time</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Actions</div>
          </div>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {modules.map((module) => (
            <div key={module.id}>
              {/* Module Row */}
              <div className={`px-4 py-3 ${c.moduleHeader} hover:bg-opacity-80 transition-colors`}>
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3 flex items-center gap-2">
                    <button onClick={() => toggleModule(module.id)} className="p-1">
                      {expandedModules.has(module.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <span className={`font-semibold ${c.moduleText}`}>{module.title}</span>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="date"
                      value={module.plan_date || ''}
                      onChange={(e) => handleUpdatePlanDate(module.id, e.target.value)}
                      className={`px-2 py-1 text-xs border ${c.moduleBorder} rounded ${c.text}`}
                    />
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-gray-400">-</span>
                  </div>
                  <div className="col-span-1">
                    <span className="text-xs text-gray-400">-</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-gray-500">Module</span>
                  </div>
                  <div className="col-span-2">
                    <button
                      onClick={() => handleDeleteActivity(module.id)}
                      className="p-1 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Children (when expanded) */}
              {expandedModules.has(module.id) && (
                <>
                  {module.children?.map((activity) => (
                    <div key={activity.id} className={`px-4 py-2 ${c.cardBg} hover:bg-opacity-80 transition-colors`}>
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-3 flex items-center gap-2 pl-12">
                          <GripVertical className="h-3 w-3 text-gray-400" />
                          <span className={`text-sm ${c.text}`}>{activity.title}</span>
                        </div>
                        <div className="col-span-2">
                          <input
                            type="date"
                            value={activity.plan_date || ''}
                            onChange={(e) => handleUpdatePlanDate(activity.id, e.target.value)}
                            className={`w-full px-2 py-1 text-xs border ${c.moduleBorder} rounded ${c.text}`}
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="url"
                            value={activity.resource_url || ''}
                            onChange={(e) => handleUpdateResourceUrl(activity.id, e.target.value)}
                            placeholder="URL..."
                            className={`w-full px-2 py-1 text-xs border ${c.moduleBorder} rounded ${c.text}`}
                          />
                        </div>
                        <div className="col-span-1">
                          <input
                            type="number"
                            value={activity.estimated_minutes || ''}
                            onChange={(e) => handleUpdateEstimatedMinutes(activity.id, e.target.value)}
                            placeholder="min"
                            min="0"
                            className={`w-full px-2 py-1 text-xs border ${c.moduleBorder} rounded ${c.text}`}
                          />
                        </div>
                        <div className="col-span-2">
                          <select
                            value={activity.activity_type}
                            onChange={(e) => handleUpdateActivityType(activity.id, e.target.value)}
                            className={`w-full px-2 py-1 text-xs border ${c.moduleBorder} rounded ${c.text} capitalize`}
                          >
                            <option value="assignment">Assignment</option>
                            <option value="quiz">Quiz</option>
                            <option value="discussion">Discussion</option>
                            <option value="page">Page</option>
                            <option value="file">File</option>
                            <option value="video">Video</option>
                            <option value="workgroup">Workgroup</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <button
                            onClick={() => handleDeleteActivity(activity.id)}
                            className="p-1 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Quick Add Activity Row */}
                  <div className={`px-4 py-2 ${c.cardBg} border-t ${c.divider}`}>
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3 pl-12">
                        <input
                          type="text"
                          value={selectedModuleId === module.id ? newActivityTitle : ''}
                          onChange={(e) => {
                            setSelectedModuleId(module.id);
                            setNewActivityTitle(e.target.value);
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              setSelectedModuleId(module.id);
                              handleAddActivity();
                            }
                          }}
                          placeholder="Add activity..."
                          className={`w-full px-2 py-1 text-sm border ${c.moduleBorder} rounded ${c.text}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="date"
                          value={selectedModuleId === module.id ? newActivityDate : ''}
                          onChange={(e) => {
                            setSelectedModuleId(module.id);
                            setNewActivityDate(e.target.value);
                          }}
                          className={`w-full px-2 py-1 text-xs border ${c.moduleBorder} rounded ${c.text}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="url"
                          value={selectedModuleId === module.id ? newActivityUrl : ''}
                          onChange={(e) => {
                            setSelectedModuleId(module.id);
                            setNewActivityUrl(e.target.value);
                          }}
                          placeholder="URL..."
                          className={`w-full px-2 py-1 text-xs border ${c.moduleBorder} rounded ${c.text}`}
                        />
                      </div>
                      <div className="col-span-1">
                        <input
                          type="number"
                          value={selectedModuleId === module.id ? newActivityEstimatedMinutes : ''}
                          onChange={(e) => {
                            setSelectedModuleId(module.id);
                            setNewActivityEstimatedMinutes(e.target.value);
                          }}
                          placeholder="min"
                          min="0"
                          className={`w-full px-2 py-1 text-xs border ${c.moduleBorder} rounded ${c.text}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <select
                          value={selectedModuleId === module.id ? newActivityType : 'assignment'}
                          onChange={(e) => {
                            setSelectedModuleId(module.id);
                            setNewActivityType(e.target.value);
                          }}
                          className={`w-full px-2 py-1 text-xs border ${c.moduleBorder} rounded ${c.text}`}
                        >
                          <option value="assignment">Assignment</option>
                          <option value="quiz">Quiz</option>
                          <option value="discussion">Discussion</option>
                          <option value="page">Page</option>
                          <option value="file">File</option>
                          <option value="video">Video</option>
                          <option value="workgroup">Workgroup</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <button
                          onClick={() => {
                            setSelectedModuleId(module.id);
                            handleAddActivity();
                          }}
                          disabled={!newActivityTitle || selectedModuleId !== module.id}
                          className={`p-1 ${c.checkboxChecked} text-white rounded hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
