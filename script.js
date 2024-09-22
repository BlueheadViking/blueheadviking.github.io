// Insert your Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoiZ3JpZmZpbmhhZGxhbmQiLCJhIjoiY20wMWcybG01MHJrMDJxb3EwbXkzOTk1NSJ9.ITxANpBn3lkoGjNKMcKMoQ';

// Initialize the map with your custom details
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/griffinhadland/clv0coy2u007l01q15qo4926v',
  center: [170.499, -45.877], // Initial map center [lng, lat]
  zoom: 12 // Initial zoom level
});

// URL of your published Google Sheet CSV
const googleSheetURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR3Fe-pYxXgok8xlvp4t10khMGF2j8vRrKf8Rt4q2KpN-7a-XSuvUPM0uPhs2w8gsrpBEkaPW2b7c2t/pub?output=csv';

// Fetch and parse the CSV data
Papa.parse(googleSheetURL, {
  download: true,
  header: true,
  complete: function(results) {
    const photoData = results.data;
    const geoJsonData = convertToGeoJSON(photoData);
    addClusteredMarkers(geoJsonData); // Function to add clustered markers
  },
  error: function(err) {
    console.error('Error fetching or parsing data:', err);
  }
});

// Function to convert CSV data to GeoJSON format
function convertToGeoJSON(photoData) {
  const features = photoData.map(photo => {
    const longitude = parseFloat(photo.longitude);
    const latitude = parseFloat(photo.latitude);

    if (isNaN(longitude) || isNaN(latitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      console.warn(`Invalid coordinates for photo titled "${photo.title}"`);
      return null;
    }

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      properties: {
        title: photo.title,
        story: photo.story,
        imagePreview: photo.imagePreview,
        imageFull: photo.imageFull
      }
    };
  });

  return {
    type: 'FeatureCollection',
    features: features.filter(feature => feature !== null)
  };
}

// Function to add clustered markers to the map
function addClusteredMarkers(geoJsonData) {
  // Add a new source from the GeoJSON data and enable clustering
  map.addSource('photos', {
    type: 'geojson',
    data: geoJsonData,
    cluster: true,
    clusterMaxZoom: 14, // Max zoom level for clustering
    clusterRadius: 50    // Radius of each cluster when clustering points (in pixels)
  });

  // Add a layer for the clusters
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'photos',
    filter: ['has', 'point_count'],
    paint: {
      // Use step expressions (https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions-step)
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#51bbd6',
        100,
        '#f28cb1',
        750,
        '#f1f075'
      ],
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        15,
        100,
        20,
        750,
        25
      ]
    }
  });

  // Add a layer for the cluster count (number of points inside each cluster)
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'photos',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 12
    }
  });

  // Add a layer for unclustered points
  map.addLayer({
    id: 'unclustered-point',
    type: 'circle',
    source: 'photos',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#11b4da',
      'circle-radius': 8,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#fff'
    }
  });

  // Zoom in on cluster click
  map.on('click', 'clusters', function (e) {
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['clusters']
    });
    const clusterId = features[0].properties.cluster_id;
    map.getSource('photos').getClusterExpansionZoom(clusterId, function (err, zoom) {
      if (err) return;

      map.easeTo({
        center: features[0].geometry.coordinates,
        zoom: zoom
      });
    });
  });

  // When a point is clicked, display information
  map.on('click', 'unclustered-point', function (e) {
    const coordinates = e.features[0].geometry.coordinates.slice();
    const { title, story, imagePreview } = e.features[0].properties;

    // Ensure the popup appears over the correct point
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }

    new mapboxgl.Popup()
      .setLngLat(coordinates)
      .setHTML(`<h3>${title}</h3><img src="${imagePreview}" alt="${title}" style="width: 100%;"><p>${story}</p>`)
      .addTo(map);
  });

  // Change the cursor to a pointer when hovering over a cluster
  map.on('mouseenter', 'clusters', function () {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'clusters', function () {
    map.getCanvas().style.cursor = '';
  });
}
