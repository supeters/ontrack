import nodeIcal from 'node-ical';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const feedUrl = searchParams.get('url');

  // Guard clause for missing or empty URL
  if (!feedUrl) {
    return Response.json({ error: 'Missing required "url" parameter' }, { status: 400 });
  }

  // Set window boundaries (e.g., fetch from beginning of month to 1 month out)
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - 14);
  const rangeEnd = new Date();
  rangeEnd.setDate(rangeEnd.getDate() + 60);

  const events = await nodeIcal.async.fromURL(feedUrl);
  const expandedEvents: any[] = [];

  for (const k in events) {
    const event = events[k];
    if (event.type !== 'VEVENT') continue;

    // Handle Recurring Events (RRULE)
    if (event.rrule) {
      const dates = event.rrule.between(rangeStart, rangeEnd, true);
      dates.forEach((date) => {
        // Calculate original time offset for each recurring date
        const duration = event.end - event.start;
        const startDate = new Date(date);
        const endDate = new Date(startDate.getTime() + duration);

        expandedEvents.push({
          id: `${event.uid}_${startDate.toISOString()}`,
          title: event.summary,
          plan_date: startDate.toISOString(),
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          is_ical: true,
        });
      });
    } else {
      // Regular single event
      expandedEvents.push({
        id: event.uid,
        title: event.summary,
        plan_date: new Date(event.start).toISOString(),
        start_time: new Date(event.start).toISOString(),
        end_time: new Date(event.end).toISOString(),
        is_ical: true,
      });
    }
  }

  return Response.json({ events: expandedEvents });
}