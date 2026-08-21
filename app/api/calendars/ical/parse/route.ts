import nodeIcal from 'node-ical';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const feedUrl = searchParams.get('url');

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

    // Check that event exists and is a VEVENT
    if (!event || event.type !== 'VEVENT') continue;

    // Handle Recurring Events (RRULE)
    if (event.rrule) {
      const dates = event.rrule.between(rangeStart, rangeEnd, true);
      const duration =
        event.start && event.end
          ? new Date(event.end).getTime() - new Date(event.start).getTime()
          : 0;

      dates.forEach((date) => {
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
    } else if (event.start) {
      // Regular single event
      const startDate = new Date(event.start);
      const endDate = event.end ? new Date(event.end) : startDate;

      expandedEvents.push({
        id: event.uid,
        title: event.summary,
        plan_date: startDate.toISOString(),
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        is_ical: true,
      });
    }
  }

  return Response.json({ events: expandedEvents });
}