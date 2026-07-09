// Approximate [lng, lat] center (state capital, or geographic center for
// states that share a capital) for each of the 36 India states/UTs in
// india-states-districts.json. Used to bias Mapbox searchPlaces() proximity
// once a user has picked a state via LocationPicker, instead of the previous
// hardcoded Delhi-only bias.
export const STATE_CENTERS: Record<string, [number, number]> = {
  'Andaman and Nicobar Islands': [92.7265, 11.6234],
  'Andhra Pradesh': [80.5180, 16.5417],
  'Arunachal Pradesh': [93.6053, 27.0844],
  'Assam': [91.7362, 26.1445],
  'Bihar': [85.1376, 25.5941],
  'Chandigarh': [76.7794, 30.7333],
  'Chhattisgarh': [81.6296, 21.2514],
  'Dadra and Nagar Haveli and Daman and Diu': [72.8397, 20.3974],
  'Delhi': [77.2090, 28.6139],
  'Goa': [73.8278, 15.4909],
  'Gujarat': [72.6369, 23.2156],
  'Haryana': [76.0856, 29.0588],
  'Himachal Pradesh': [77.1734, 31.1048],
  'Jammu and Kashmir': [74.7973, 34.0837],
  'Jharkhand': [85.3096, 23.3441],
  'Karnataka': [77.5946, 12.9716],
  'Kerala': [76.9366, 8.5241],
  'Ladakh': [77.5771, 34.1526],
  'Lakshadweep': [72.6420, 10.5593],
  'Madhya Pradesh': [77.4126, 23.2599],
  'Maharashtra': [72.8777, 19.0760],
  'Manipur': [93.9063, 24.8170],
  'Meghalaya': [91.8933, 25.5788],
  'Mizoram': [92.7176, 23.7271],
  'Nagaland': [94.1077, 25.6751],
  'Odisha': [85.8245, 20.2961],
  'Puducherry': [79.8083, 11.9416],
  'Punjab': [75.3412, 31.1471],
  'Rajasthan': [75.7873, 26.9124],
  'Sikkim': [88.6138, 27.3389],
  'Tamil Nadu': [80.2707, 13.0827],
  'Telangana': [78.4867, 17.3850],
  'Tripura': [91.2868, 23.8315],
  'Uttar Pradesh': [80.9462, 26.8467],
  'Uttarakhand': [78.0322, 30.3165],
  'West Bengal': [88.3639, 22.5726],
};

export function getStateCenter(state: string): [number, number] | undefined {
  return STATE_CENTERS[state];
}
