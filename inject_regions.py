with open('scratch_output.txt', 'r') as f:
    new_regions = f.read()

with open('backend/server.js', 'r') as f:
    content = f.read()

target = """  'Nalgonda': {
    center: { latitude: 17.0500, longitude: 79.2667 },
    depot: { latitude: 17.0420, longitude: 79.2550, name: 'Nalgonda Depot' },
    bins: [
      { id: 81, name: 'Bin 1 - Clock Tower X Roads (Main Road)', latitude: 17.0560, longitude: 79.2750, zone_type: 'Main Road', status: 'Pending', time_window: '10:00 AM - 6:00 PM', collected_at: null, photo_url: null },
      { id: 82, name: 'Bin 2 - VT Colony (Residential)', latitude: 17.0480, longitude: 79.2620, zone_type: 'Residential', status: 'Pending', time_window: '6:00 AM - 10:00 AM', collected_at: null, photo_url: null },
      { id: 83, name: 'Bin 3 - Devarakonda Road (Main Road)', latitude: 17.0380, longitude: 79.2500, zone_type: 'Main Road', status: 'Pending', time_window: '10:00 AM - 6:00 PM', collected_at: null, photo_url: null },
      { id: 84, name: 'Bin 4 - NGO Colony (Residential)', latitude: 17.0620, longitude: 79.2700, zone_type: 'Residential', status: 'Pending', time_window: '6:00 AM - 10:00 AM', collected_at: null, photo_url: null }
    ],
    activeRoute: null,
    routeMetrics: null,
    telemetry: null
  }
};"""

replacement = target.replace('  }\n};', '  },' + new_regions + '\n};')
content = content.replace(target, replacement)

with open('backend/server.js', 'w') as f:
    f.write(content)
print('Updated server.js')
