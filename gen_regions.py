regions = [
  ('Secunderabad', 17.4399, 78.4983),
  ('JubileeHills', 17.4325, 78.4071),
  ('BanjaraHills', 17.4156, 78.4396),
  ('LBNagar', 17.3457, 78.5522),
  ('Charminar', 17.3616, 78.4747),
  ('Khairatabad', 17.4116, 78.4593),
  ('Serilingampally', 17.4834, 78.3188),
  ('Malkajgiri', 17.4520, 78.5332),
  ('Quthbullapur', 17.5190, 78.4552),
  ('Uppal', 17.3984, 78.5583),
  ('Rajendranagar', 17.3190, 78.4039)
]

output = ''
id_counter = 100

for name, lat, lng in regions:
    output += f"""
  '{name}': {{
    center: {{ latitude: {lat}, longitude: {lng} }},
    depot: {{ latitude: {lat - 0.005}, longitude: {lng - 0.005}, name: '{name} Depot' }},
    bins: [
      {{ id: {id_counter}, name: 'Bin 1 - {name} Main (Main Road)', latitude: {lat + 0.006}, longitude: {lng + 0.004}, zone_type: 'Main Road', status: 'Pending', time_window: '10:00 AM - 6:00 PM', collected_at: null, photo_url: null }},
      {{ id: {id_counter+1}, name: 'Bin 2 - {name} Market (Main Road)', latitude: {lat + 0.002}, longitude: {lng + 0.008}, zone_type: 'Main Road', status: 'Pending', time_window: '10:00 AM - 6:00 PM', collected_at: null, photo_url: null }},
      {{ id: {id_counter+2}, name: 'Bin 3 - {name} Park (Residential)', latitude: {lat - 0.004}, longitude: {lng + 0.005}, zone_type: 'Residential', status: 'Pending', time_window: '6:00 AM - 10:00 AM', collected_at: null, photo_url: null }},
      {{ id: {id_counter+3}, name: 'Bin 4 - {name} Colony (Residential)', latitude: {lat + 0.005}, longitude: {lng - 0.006}, zone_type: 'Residential', status: 'Pending', time_window: '6:00 AM - 10:00 AM', collected_at: null, photo_url: null }}
    ],
    activeRoute: null,
    routeMetrics: null,
    telemetry: null
  }},"""
    id_counter += 10

with open('scratch_output.txt', 'w') as f:
    f.write(output)
print('Done')
