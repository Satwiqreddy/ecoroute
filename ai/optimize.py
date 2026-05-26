#!/usr/bin/env python3
import sys
import json
import math
import heapq

# Try to import OR-Tools; we will use a fallback heuristic if it's not installed or fails
OR_TOOLS_AVAILABLE = False
try:
    from ortools.constraint_solver import routing_enums_pb2
    from ortools.constraint_solver import pywrapcp
    OR_TOOLS_AVAILABLE = True
except ImportError:
    pass

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate the great circle distance between two points on the earth in km."""
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.asin(math.sqrt(a))
    return R * c

def dijkstra(graph, start, end):
    """Run Dijkstra's shortest path algorithm on a weighted graph."""
    queue = [(0.0, start, [])]
    seen = set()
    while queue:
        (cost, node, path) = heapq.heappop(queue)
        if node not in seen:
            seen.add(node)
            path = path + [node]
            if node == end:
                return cost, path
            for next_node, weight in graph.get(node, {}).items():
                if next_node not in seen:
                    heapq.heappush(queue, (cost + weight, next_node, path))
    return float('inf'), []

def build_regional_graph(region, depot, bins):
    """Build a virtual road network graph using intersections and bins."""
    graph = {}
    
    # Define local intersection nodes for the region
    intersections = {
        'Miyapur': [
            {"id": "Int_MiyapurXRoads", "latitude": 17.4968, "longitude": 78.3614},
            {"id": "Int_AmeenpurCrossing", "latitude": 17.5020, "longitude": 78.3550},
            {"id": "Int_MetroJunction", "latitude": 17.4930, "longitude": 78.3650}
        ],
        'Gachibowli': [
            {"id": "Int_DLFCircle", "latitude": 17.4400, "longitude": 78.3500},
            {"id": "Int_IIITCrossing", "latitude": 17.4450, "longitude": 78.3450},
            {"id": "Int_WiproCircle", "latitude": 17.4280, "longitude": 78.3450}
        ],
        'Kukatpally': [
            {"id": "Int_JNTUCrossing", "latitude": 17.4900, "longitude": 78.3850},
            {"id": "Int_KPHBJunction", "latitude": 17.4820, "longitude": 78.3950}
        ],
        'Warangal': [
            {"id": "Int_HanamkondaCircle", "latitude": 17.9700, "longitude": 79.5950},
            {"id": "Int_FortCrossing", "latitude": 17.9580, "longitude": 79.5900}
        ],
        'Nizamabad': [
            {"id": "Int_KanteshwarJunction", "latitude": 18.6800, "longitude": 78.1100},
            {"id": "Int_RailwayCrossing", "latitude": 18.6700, "longitude": 78.1000}
        ]
    }
    
    # Get local intersections
    local_ints = intersections.get(region, [
        {"id": "Int_Default1", "latitude": depot['latitude'] + 0.005, "longitude": depot['longitude'] + 0.005},
        {"id": "Int_Default2", "latitude": depot['latitude'] - 0.005, "longitude": depot['longitude'] - 0.005}
    ])
    
    # All nodes: Depot (id "Depot"), Bins (ids "Bin_1", "Bin_2"...), Intersections
    all_nodes = []
    all_nodes.append({"id": "Depot", "latitude": depot['latitude'], "longitude": depot['longitude']})
    for b in bins:
        all_nodes.append({"id": f"Bin_{b['id']}", "latitude": b['latitude'], "longitude": b['longitude']})
    for intersection in local_ints:
        all_nodes.append(intersection)
        
    # Build adjacency list: connect nodes that are close to each other
    n = len(all_nodes)
    for i in range(n):
        node_i = all_nodes[i]
        node_id_i = node_i["id"]
        if node_id_i not in graph:
            graph[node_id_i] = {}
            
        for j in range(i + 1, n):
            node_j = all_nodes[j]
            node_id_j = node_j["id"]
            if node_id_j not in graph:
                graph[node_id_j] = {}
                
            dist = haversine_distance(node_i['latitude'], node_i['longitude'], node_j['latitude'], node_j['longitude'])
            
            # sparse threshold
            is_int_connection = node_id_i.startswith("Int_") or node_id_j.startswith("Int_")
            if dist < 1.8 or (is_int_connection and dist < 3.0):
                # Add edge
                graph[node_id_i][node_id_j] = dist
                graph[node_id_j][node_id_i] = dist
                
    return graph

def calculate_matrices_dijkstra(region, depot, bins):
    """Calculate distance matrix using Dijkstra's shortest path on the road graph."""
    graph = build_regional_graph(region, depot, bins)
    
    locations = ["Depot"] + [f"Bin_{b['id']}" for b in bins]
    n = len(locations)
    
    distance_matrix = []
    travel_time_matrix = []
    
    sys.stderr.write(f"\n[Dijkstra Engine] Running Dijkstra shortest-path router on [{region}] graph...\n")
    sys.stderr.write(f"[Dijkstra Engine] Total intersections & points of interest: {len(graph)}\n")
    
    for i in range(n):
        dist_row = []
        time_row = []
        start_node = locations[i]
        for j in range(n):
            if i == j:
                dist_row.append(0.0)
                time_row.append(0)
            else:
                end_node = locations[j]
                # Run Dijkstra's algorithm
                dist, path = dijkstra(graph, start_node, end_node)
                
                # If disconnected, fall back to haversine direct distance
                if dist == float('inf'):
                    loc_i = depot if start_node == "Depot" else next(b for b in bins if f"Bin_{b['id']}" == start_node)
                    loc_j = depot if end_node == "Depot" else next(b for b in bins if f"Bin_{b['id']}" == end_node)
                    dist = haversine_distance(loc_i['latitude'], loc_i['longitude'], loc_j['latitude'], loc_j['longitude'])
                    path = [start_node, end_node]
                
                dist_row.append(dist)
                time_row.append(int(dist * 2.0)) # Speed = 30km/h -> 2 mins/km
                
        # Log path for a few routes to verify Dijkstra execution
        if i == 0 and len(locations) > 1:
            dest_node = locations[1]
            path_str = " -> ".join(path)
            sys.stderr.write(f"[Dijkstra Engine] Path: {start_node} to {dest_node} -> [{path_str}] (Distance: {dist_row[1]:.2f} km)\n")
            
        distance_matrix.append(dist_row)
        travel_time_matrix.append(time_row)
        
    return distance_matrix, travel_time_matrix

def fallback_heuristic_multi(bins, num_vehicles):
    """Fallback heuristic: Distribute bins round-robin across vehicles."""
    residential = [b for b in bins if b['zone_type'] == 'Residential']
    main_roads = [b for b in bins if b['zone_type'] == 'Main Road']
    ordered_bins = residential + main_roads
    
    routes = {f"Truck_{i+1}": [] for i in range(num_vehicles)}
    for idx, b in enumerate(ordered_bins):
        vehicle_id = idx % num_vehicles
        routes[f"Truck_{vehicle_id+1}"].append(b['id'])
    return routes

def solve_vrptw(depot, bins, region='Miyapur', num_vehicles=1):
    """Solve VRPTW for multiple vehicles using Google OR-Tools and Dijkstra distance metrics."""
    if not OR_TOOLS_AVAILABLE:
        sys.stderr.write(f"[Dijkstra Engine] OR-Tools not available. Distributing bins across {num_vehicles} trucks.\n")
        return fallback_heuristic_multi(bins, num_vehicles)
        
    num_locations = len(bins) + 1
    depot_index = 0
    
    distance_matrix, travel_time_matrix = calculate_matrices_dijkstra(region, depot, bins)
    
    # Create the routing index manager
    manager = pywrapcp.RoutingIndexManager(num_locations, num_vehicles, depot_index)
    
    # Create Routing Model
    routing = pywrapcp.RoutingModel(manager)
    
    # Register travel time callback
    def time_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        transit = travel_time_matrix[from_node][to_node]
        service = 5 if from_node != 0 else 0
        return transit + service
        
    transit_callback_index = routing.RegisterTransitCallback(time_callback)
    
    # Define cost of each link
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
    
    # Add Time Windows dimension
    time_dimension_name = 'Time'
    routing.AddDimension(
        transit_callback_index,
        180,  # allow waiting time up to 180 minutes
        1440, # maximum route duration (24 hours)
        False,
        time_dimension_name
    )
    time_dimension = routing.GetDimensionOrDie(time_dimension_name)
    
    # Minimize the maximum route duration (minimizes makespan to balance workload)
    time_dimension.SetGlobalSpanCostCoefficient(100)
    
    # Add Capacity dimension to force splitting work across all active vehicles
    def demand_callback(from_index):
        from_node = manager.IndexToNode(from_index)
        if from_node == 0:
            return 0
        return 1

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    
    # Set capacity of each vehicle to partition work evenly
    max_capacity = max(1, math.ceil(len(bins) / num_vehicles))
    # Give 1 extra capacity buffer if there's enough bins, to handle time window feasibility constraints
    if num_vehicles > 1 and len(bins) > num_vehicles:
        max_capacity += 1
        
    vehicle_capacities = [max_capacity] * num_vehicles
    
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,  # null capacity slack
        vehicle_capacities,  # vehicle maximum capacities
        True,  # start cumul to zero
        'Capacity'
    )
    
    # Set time windows and remove peak hours for each bin
    for node_idx in range(1, num_locations):
        bin_data = bins[node_idx - 1]
        if bin_data['zone_type'] == 'Main Road':
            tw_start, tw_end = 240, 720
        else:
            tw_start, tw_end = 0, 240
            
        index = manager.NodeToIndex(node_idx)
        time_var = time_dimension.CumulVar(index)
        time_var.SetRange(tw_start, tw_end)
        
        # Avoid morning peak (8:30 AM - 11:30 AM -> 150 to 330 min from shift start at 6 AM)
        time_var.RemoveInterval(150, 330)
        # Avoid evening peak (5:30 PM - 8:30 PM -> 690 to 870 min from shift start at 6 AM)
        time_var.RemoveInterval(690, 870)
        
    # Depot time window and peak hour avoidance for all vehicles
    for vehicle_id in range(num_vehicles):
        for depot_idx in [routing.Start(vehicle_id), routing.End(vehicle_id)]:
            time_var = time_dimension.CumulVar(depot_idx)
            time_var.SetRange(0, 1440)
            time_var.RemoveInterval(150, 330)
            time_var.RemoveInterval(690, 870)
    
    # Set Search Parameters
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_parameters.time_limit.seconds = 5
    
    # Solve
    solution = routing.SolveWithParameters(search_parameters)
    
    if solution:
        routes = {f"Truck_{i+1}": [] for i in range(num_vehicles)}
        for vehicle_id in range(num_vehicles):
            index = routing.Start(vehicle_id)
            while not routing.IsEnd(index):
                node_idx = manager.IndexToNode(index)
                if node_idx != 0:
                    routes[f"Truck_{vehicle_id+1}"].append(bins[node_idx - 1]['id'])
                index = solution.Value(routing.NextVar(index))
        return routes
    else:
        sys.stderr.write("[Dijkstra Engine] OR-Tools failed to solve VRPTW. Distributing round-robin.\n")
        return fallback_heuristic_multi(bins, num_vehicles)

if __name__ == "__main__":
    # Test Mode
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        print("Running in test mode...")
        mock_depot = {"latitude": 17.4950, "longitude": 78.3580}
        mock_bins = [
            {"id": 1, "latitude": 17.5020, "longitude": 78.3650, "zone_type": "Main Road"},
            {"id": 2, "latitude": 17.4910, "longitude": 78.3720, "zone_type": "Main Road"},
            {"id": 3, "latitude": 17.4850, "longitude": 78.3580, "zone_type": "Residential"},
            {"id": 4, "latitude": 17.4890, "longitude": 78.3490, "zone_type": "Residential"}
        ]
        routes = solve_vrptw(mock_depot, mock_bins, "Miyapur", 2)
        print("Optimized Sequence for 2 trucks:")
        print(routes)
        sys.exit(0)
        
    # Production Mode (Input via stdin)
    try:
        input_data = json.loads(sys.stdin.read())
        region = input_data.get('region', 'Miyapur')
        depot = input_data['depot']
        bins = input_data['bins']
        trucks = int(input_data.get('trucks', 1))
        
        sequence = solve_vrptw(depot, bins, region, trucks)
        
        # Calculate routing metrics using Dijkstra pathfinding
        dist_matrix, _ = calculate_matrices_dijkstra(region, depot, bins)
        
        # Naive distance
        naive_seq = list(range(len(bins) + 1))
        naive_dist = sum(dist_matrix[naive_seq[i]][naive_seq[i+1]] for i in range(len(naive_seq)-1))
        naive_dist += dist_matrix[naive_seq[-1]][0]
        
        # Optimized distance sum across all active trucks
        bin_id_to_idx = {bins[i]['id']: i + 1 for i in range(len(bins))}
        optimized_dist = 0.0
        for vehicle, seq in sequence.items():
            if len(seq) > 0:
                opt_seq = [0] + [bin_id_to_idx[bid] for bid in seq] + [0]
                optimized_dist += sum(dist_matrix[opt_seq[i]][opt_seq[i+1]] for i in range(len(opt_seq)-1))
        
        distance_saved = max(0.0, naive_dist - optimized_dist)
        
        output = {
            "success": True,
            "route_sequence": sequence,
            "metrics": {
                "distance_saved_km": round(distance_saved, 2),
                "fuel_saved_liters": round(distance_saved * 0.35, 2),
                "co2_saved_kg": round(distance_saved * 0.35 * 2.68, 2),
                "optimized_distance_km": round(optimized_dist, 2),
                "unoptimized_distance_km": round(naive_dist, 2)
            }
        }
        print(json.dumps(output))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
