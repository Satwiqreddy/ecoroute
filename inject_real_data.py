import os
import random
import math
from supabase import create_client, Client

SUPABASE_URL = "https://wmdpduschuizcpdjjvvf.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtZHBkdXNjaHVpemNwZGpqdnZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjY4NjAsImV4cCI6MjA5NTQwMjg2MH0.xUpOHCVboikssGm972MEHglB9bOy0VzW07xjOHEKGbY"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

TELANGANA_REGIONS = [
    { 'name': 'Miyapur', 'displayName': 'Hyderabad - Miyapur (మియాపూర్)', 'center': [17.4968, 78.3614] },
    { 'name': 'Gachibowli', 'displayName': 'Hyderabad - Gachibowli (గచ్చిబౌలి)', 'center': [17.4401, 78.3489] },
    { 'name': 'Kukatpally', 'displayName': 'Hyderabad - Kukatpally (కూకట్‌పల్లి)', 'center': [17.4855, 78.3885] },
    { 'name': 'Warangal', 'displayName': 'Warangal Municipal Corp (వరంగల్)', 'center': [17.9689, 79.5941] },
    { 'name': 'Nizamabad', 'displayName': 'Nizamabad Municipal Corp (నిజామాబాద్)', 'center': [18.6725, 78.0986] },
    { 'name': 'Karimnagar', 'displayName': 'Karimnagar Municipal Corp (కరీంనగర్)', 'center': [18.4386, 79.1288] },
    { 'name': 'Khammam', 'displayName': 'Khammam Municipal Corp (ఖమ్మం)', 'center': [17.2473, 80.1514] },
    { 'name': 'Mahbubnagar', 'displayName': 'Mahbubnagar Municipal Corp (మహబూబ్‌నగర్)', 'center': [16.7367, 77.9889] },
    { 'name': 'Nalgonda', 'displayName': 'Nalgonda Municipal Corp (నల్గొండ)', 'center': [17.0500, 79.2667] },
    { 'name': 'Adilabad', 'displayName': 'Adilabad Municipal Corp (ఆదిలాబాద్)', 'center': [19.6667, 78.5333] },
    { 'name': 'Secunderabad', 'displayName': 'Secunderabad (సికింద్రాబాద్)', 'center': [17.4399, 78.4983] },
    { 'name': 'JubileeHills', 'displayName': 'Jubilee Hills (జూబ్లీ హిల్స్)', 'center': [17.4325, 78.4071] },
    { 'name': 'BanjaraHills', 'displayName': 'Banjara Hills (బంజారా హిల్స్)', 'center': [17.4156, 78.4347] },
    { 'name': 'Madhapur', 'displayName': 'Madhapur (మాదాపూర్)', 'center': [17.4483, 78.3915] },
    { 'name': 'Begumpet', 'displayName': 'Begumpet (బేగంపేట)', 'center': [17.4447, 78.4664] },
    { 'name': 'Khairatabad', 'displayName': 'Khairatabad (ఖైరతాబాద్)', 'center': [17.4116, 78.4593] },
    { 'name': 'Serilingampally', 'displayName': 'Serilingampally (శేరిలింగంపల్లి)', 'center': [17.4834, 78.3188] },
    { 'name': 'Ramagundam', 'displayName': 'Ramagundam (రామగుండం)', 'center': [18.7639, 79.4750] },
    { 'name': 'Suryapet', 'displayName': 'Suryapet (సూర్యాపేట)', 'center': [17.1384, 79.6236] },
    { 'name': 'Miryalaguda', 'displayName': 'Miryalaguda (మిర్యాలగూడ)', 'center': [16.8744, 79.5622] }
]

def generate_points(center_lat, center_lon, num_points, radius_km=3.0):
    points = []
    for _ in range(num_points):
        angle = random.uniform(0, 2 * math.pi)
        r = radius_km * math.sqrt(random.uniform(0, 1))
        # 1 deg lat ~ 111 km, 1 deg lon ~ 111 * cos(lat) km
        dlat = r / 111.0
        dlon = r / (111.0 * math.cos(math.radians(center_lat)))
        points.append({
            'lat': center_lat + dlat * math.sin(angle),
            'lon': center_lon + dlon * math.cos(angle)
        })
    return points

def run():
    print("Clearing old data...")
    # Because of CASCADE, deleting regions deletes depots, bins, and active_routes
    supabase.table('regions').delete().neq('name', 'dummy').execute()
    
    for r in TELANGANA_REGIONS:
        print(f"Injecting region: {r['name']}...")
        
        # 1. Insert Region
        supabase.table('regions').insert({
            'name': r['name'],
            'display_name': r['displayName'],
            'latitude': r['center'][0],
            'longitude': r['center'][1],
            'allocated_trucks': 5
        }).execute()
        
        # 2. Insert Depot
        # Offset depot slightly from center
        depot_lat = r['center'][0] - 0.005
        depot_lon = r['center'][1] - 0.005
        supabase.table('depots').insert({
            'region_name': r['name'],
            'name': f"{r['name']} Central Depot",
            'latitude': depot_lat,
            'longitude': depot_lon
        }).execute()
        
        # 3. Insert Bins
        bins_data = []
        points = generate_points(r['center'][0], r['center'][1], 12, 4.0)
        for idx, pt in enumerate(points):
            is_main = idx < 4
            bins_data.append({
                'region_name': r['name'],
                'name': f"Bin {idx+1} - {r['name']} ({'Main Road' if is_main else 'Residential'})",
                'latitude': pt['lat'],
                'longitude': pt['lon'],
                'zone_type': 'Main Road' if is_main else 'Residential',
                'status': 'Pending',
                'time_window': '10:00 AM - 6:00 PM' if is_main else '6:00 AM - 10:00 AM'
            })
        supabase.table('bins').insert(bins_data).execute()
        
    print("✅ Successfully injected all real data!")

if __name__ == "__main__":
    run()
