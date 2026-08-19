// Base CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to format JavaScript Date objects into ICS format (YYYYMMDDTHHMMSSZ)
const formatICSDate = (date: Date): string => {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// Format as local time (no Z suffix = floating time)
const formatICSDateLocal = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}T${hours}${minutes}${seconds}`
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const kidId = url.searchParams.get('kid_id')
    const secret = url.searchParams.get('secret')
    
    if (secret !== 'family-calendar-2025') {
      return new Response('Access denied', { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
      })
    }
    
    if (!kidId) {
      return new Response('Missing kid_id parameter', { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response('Server configuration error', { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
      })
    }

    const kidNames: Record<string, string> = {
      '1': 'Nathan',
      '2': 'Hadasa', 
      '3': 'Jerusha',
      '4': 'Kezia'
    }
    
    const kidName = kidNames[kidId] || 'Student'

    const today = new Date().toISOString().split('T')[0]
    const response = await fetch(
      `${supabaseUrl}/rest/v1/activities?kid_id=eq.${kidId}&is_deleted=eq.false&is_hidden=eq.false&plan_date=gte.${today}&start_time=not.is.null&activity_type=in.(class,event)&select=id,title,description,activity_type,plan_date,start_time,end_time,estimated_minutes&order=start_time.asc`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Database query failed: ${response.statusText}`)
    }

    const activities = await response.json()

    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Family Dashboard//Live Calendar//EN',
      `X-WR-CALNAME:${kidName}'s Schedule`,
      'X-WR-CALDESC:Live calendar from Family Dashboard',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ]

    activities.forEach((activity: any) => {
      let startDate: Date
      let endDate: Date
      
      if (activity.start_time) {
        const formattedStartTime = String(activity.start_time).replace(' ', 'T')
        startDate = new Date(formattedStartTime)

        if (activity.end_time) {
          const formattedEndTime = String(activity.end_time).replace(' ', 'T')
          endDate = new Date(formattedEndTime)
        } else {
          endDate = new Date(startDate.getTime() + (activity.estimated_minutes || 60) * 60000)
        }
      } else if (activity.plan_date) {
        const cleanDate = String(activity.plan_date).split(' ')[0]
        startDate = new Date(`${cleanDate}T09:00:00Z`)
        endDate = new Date(startDate.getTime() + (activity.estimated_minutes || 60) * 60000)
      } else {
        return
      }

      if (isNaN(startDate.getTime())) {
        console.error(`Invalid date for activity ID ${activity.id}:`, activity)
        return
      }

      // In the forEach loop, change:
      icsLines.push(
        'BEGIN:VEVENT',
        `UID:activity-${activity.id}@familydashboard.com`,
        `DTSTAMP:${formatICSDate(new Date())}`,
        `DTSTART:${formatICSDateLocal(startDate)}`,  // Changed
        `DTEND:${formatICSDateLocal(endDate)}`,      // Changed
        `SUMMARY:${activity.title || 'Event'}`,
        `DESCRIPTION:${(activity.description || '').replace(/\n/g, '\\n')}`,
        `CATEGORIES:${activity.activity_type || 'EVENT'}`,
        'END:VEVENT'
      )
    })

    icsLines.push('END:VCALENDAR')

    return new Response(icsLines.join('\r\n'), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `inline; filename="${kidName.replace(/[^a-z0-9]/gi, '_')}_calendar.ics"`
      }
    })

  } catch (error: any) {
    console.error('Error generating ICS:', error)
    return new Response(`Internal server error: ${error?.message || error}`, { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    })
  }
})