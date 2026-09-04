[
  {
    "schemaname": "public",
    "tablename": "activities",
    "policyname": "Access own activities",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(kid_id IN ( SELECT get_accessible_kid_ids() AS get_accessible_kid_ids))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "activity_grades",
    "policyname": "Access own grades",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(kid_id IN ( SELECT get_accessible_kid_ids() AS get_accessible_kid_ids))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "activity_notes",
    "policyname": "Users can manage activity notes for their kids",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "((activity_id IN ( SELECT a.id\n   FROM ((activities a\n     JOIN kids k ON ((a.kid_id = k.id)))\n     JOIN family_relationships fr ON ((k.user_id = fr.child_user_id)))\n  WHERE (fr.parent_user_id = auth.uid()))) OR (activity_id IN ( SELECT a.id\n   FROM (activities a\n     JOIN kids k ON ((a.kid_id = k.id)))\n  WHERE (k.user_id = auth.uid()))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "activity_recurrence",
    "policyname": "Users can manage templates for their kids",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(kid_id IN ( SELECT kids.id\n   FROM kids\n  WHERE (kids.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "activity_work_chunks",
    "policyname": "Access own work chunks",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(kid_id IN ( SELECT get_accessible_kid_ids() AS get_accessible_kid_ids))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "calendar_feeds",
    "policyname": "Allow delete for authenticated users",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "true",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "calendar_feeds",
    "policyname": "Allow insert for authenticated users",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "true"
  },
  {
    "schemaname": "public",
    "tablename": "calendar_feeds",
    "policyname": "Allow select for authenticated users",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "true",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "canvas_accounts",
    "policyname": "Parents can manage children Canvas accounts",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(EXISTS ( SELECT 1\n   FROM family_relationships\n  WHERE ((family_relationships.parent_user_id = auth.uid()) AND (family_relationships.child_user_id = canvas_accounts.user_id))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "canvas_accounts",
    "policyname": "Users can manage their own Canvas accounts",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "((auth.uid() = user_id) OR (EXISTS ( SELECT 1\n   FROM family_relationships\n  WHERE ((family_relationships.parent_user_id = auth.uid()) AND (family_relationships.child_user_id = canvas_accounts.user_id)))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "canvas_course_grades",
    "policyname": "Users can access Canvas course grades for their accounts",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(EXISTS ( SELECT 1\n   FROM canvas_accounts\n  WHERE ((canvas_accounts.id = canvas_course_grades.canvas_account_id) AND ((canvas_accounts.user_id = auth.uid()) OR (EXISTS ( SELECT 1\n           FROM family_relationships\n          WHERE ((family_relationships.parent_user_id = auth.uid()) AND (family_relationships.child_user_id = canvas_accounts.user_id))))))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "canvas_sync_logs",
    "policyname": "Authenticated users can create sync logs",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(auth.uid() IS NOT NULL)"
  },
  {
    "schemaname": "public",
    "tablename": "canvas_sync_logs",
    "policyname": "Authenticated users can view sync logs",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(auth.uid() IS NOT NULL)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "course_due_date_patterns",
    "policyname": "Users can manage course due date patterns",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "((course_id IS NULL) OR (course_id IN ( SELECT c.id\n   FROM (courses c\n     JOIN kids k ON ((c.kid_id = k.id)))\n  WHERE (k.user_id = auth.uid()))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "courses",
    "policyname": "Access own courses",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(kid_id IN ( SELECT get_accessible_kid_ids() AS get_accessible_kid_ids))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "family_relationships",
    "policyname": "Family relationships access",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "((auth.uid() = parent_user_id) OR (auth.uid() = child_user_id))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "jot_tag_meta",
    "policyname": "Users can manage own tag meta",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "true",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "jot_tag_meta",
    "policyname": "Users can view own tag meta",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "true",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "kid_relations",
    "policyname": "Kids can see who their parents are",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(kid_id IN ( SELECT kids.id\n   FROM kids\n  WHERE (kids.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "kid_relations",
    "policyname": "Users can view their own relations",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(parent_id IN ( SELECT kids.id\n   FROM kids\n  WHERE (kids.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "kids",
    "policyname": "Kids access policy",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "((user_id = auth.uid()) OR (user_id IN ( SELECT family_relationships.child_user_id\n   FROM family_relationships\n  WHERE (family_relationships.parent_user_id = auth.uid()))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "lms_accounts",
    "policyname": "Parents can manage all family LMS accounts",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(EXISTS ( SELECT 1\n   FROM (kids k\n     JOIN family_relationships fr ON ((k.user_id = fr.child_user_id)))\n  WHERE ((fr.parent_user_id = auth.uid()) AND (k.id = lms_accounts.kid_id))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "lms_accounts",
    "policyname": "Users can manage LMS accounts for their kids",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(kid_id IN ( SELECT kids.id\n   FROM kids\n  WHERE (kids.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "notes",
    "policyname": "Users can create their own notes",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(user_profile_id IN ( SELECT user_profiles.id\n   FROM user_profiles\n  WHERE (user_profiles.user_id = auth.uid())))"
  },
  {
    "schemaname": "public",
    "tablename": "notes",
    "policyname": "Users can delete their own notes",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "DELETE",
    "qual": "(user_profile_id IN ( SELECT user_profiles.id\n   FROM user_profiles\n  WHERE (user_profiles.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "notes",
    "policyname": "Users can update their own notes",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "UPDATE",
    "qual": "(user_profile_id IN ( SELECT user_profiles.id\n   FROM user_profiles\n  WHERE (user_profiles.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "notes",
    "policyname": "Users can view notes about students they have relations with",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(EXISTS ( SELECT 1\n   FROM (user_relations ur\n     JOIN user_profiles up ON ((ur.user_profile_id = up.id)))\n  WHERE ((up.user_id = auth.uid()) AND (ur.related_profile_id = notes.student_profile_id) AND (ur.can_view_as = true))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "notes",
    "policyname": "Users can view their own notes",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(user_profile_id IN ( SELECT user_profiles.id\n   FROM user_profiles\n  WHERE (user_profiles.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "portfolio_narratives",
    "policyname": "Users can delete own portfolio narratives",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "DELETE",
    "qual": "(auth.uid() = user_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "portfolio_narratives",
    "policyname": "Users can insert own portfolio narratives",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(auth.uid() = user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "portfolio_narratives",
    "policyname": "Users can update own portfolio narratives",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "UPDATE",
    "qual": "(auth.uid() = user_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "portfolio_narratives",
    "policyname": "Users can view own portfolio narratives",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(auth.uid() = user_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "school_week_calendars",
    "policyname": "Users can view school week calendars",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "((is_active = true) AND (EXISTS ( SELECT 1\n   FROM (courses c\n     JOIN kids k ON ((k.id = c.kid_id)))\n  WHERE ((c.school_id = school_week_calendars.school_id) AND (k.user_id = auth.uid())))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "schools",
    "policyname": "Anyone can read schools",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "true",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "schools",
    "policyname": "Authenticated users can      \r\n  manage schools",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(auth.uid() IS NOT NULL)"
  },
  {
    "schemaname": "public",
    "tablename": "schools",
    "policyname": "Users can manage their schools",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(created_by_user_id = auth.uid())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "subject_mappings",
    "policyname": "Anyone can read subject mappings",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "true",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "subject_mappings",
    "policyname": "Only service role can modify subject mappings",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(auth.role() = 'service_role'::text)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "user_profiles",
    "policyname": "Users can manage their own profile",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(user_id = auth.uid())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "user_profiles",
    "policyname": "Users can update their own profile",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "UPDATE",
    "qual": "(user_id = auth.uid())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "user_profiles",
    "policyname": "Users can view their own profile",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(user_id = auth.uid())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "user_relations",
    "policyname": "Parents can manage their relations",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(user_profile_id IN ( SELECT user_profiles.id\n   FROM user_profiles\n  WHERE ((user_profiles.user_id = auth.uid()) AND (user_profiles.role = 'parent'::text))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "user_relations",
    "policyname": "Users can view their own relations",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "((user_profile_id IN ( SELECT user_profiles.id\n   FROM user_profiles\n  WHERE (user_profiles.user_id = auth.uid()))) OR (related_profile_id IN ( SELECT user_profiles.id\n   FROM user_profiles\n  WHERE (user_profiles.user_id = auth.uid()))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "week_extraction_rules",
    "policyname": "Anyone can view week extraction rules",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(is_active = true)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "work_schedule",
    "policyname": "Users can manage work schedules for their kids",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(kid_id IN ( SELECT kids.id\n   FROM kids\n  WHERE (kids.user_id = auth.uid())))",
    "with_check": null
  }
]