/**
 * Ejemplos de Integración con React Native - API de Exploración
 * 
 * Este archivo contiene ejemplos de cómo consumir la API de exploración
 * desde la aplicación React Native de Zyra
 */

// ===========================================
// 1. SERVICE DE BÚSQUEDA (searchService.js)
// ===========================================

import api from './api'; // Tu instancia de axios configurada

/**
 * Buscar canchas con filtros
 * @param {Object} filters - Filtros de búsqueda
 * @returns {Promise<Object>}
 */
export const searchCourts = async (filters = {}) => {
  try {
    const response = await api.get('/api/explorar/canchas', {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error('Error al buscar canchas:', error);
    throw error;
  }
};

/**
 * Buscar canchas con paginación
 * @param {Object} filters - Filtros de búsqueda
 * @param {number} page - Número de página
 * @param {number} limit - Límite por página
 * @returns {Promise<Object>}
 */
export const searchCourtsWithPagination = async (filters = {}, page = 1, limit = 10) => {
  try {
    const response = await api.get('/api/explorar/canchas/paginado', {
      params: {
        ...filters,
        page,
        limit
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error al buscar canchas paginado:', error);
    throw error;
  }
};

/**
 * Obtener estadísticas de búsqueda
 * @param {Object} filters - Filtros aplicados
 * @returns {Promise<Object>}
 */
export const getSearchStats = async (filters = {}) => {
  try {
    const response = await api.get('/api/explorar/estadisticas', {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    throw error;
  }
};

/**
 * Listar deportes disponibles
 * @returns {Promise<Array>}
 */
export const getSports = async () => {
  try {
    const response = await api.get('/api/explorar/deportes');
    return response.data;
  } catch (error) {
    console.error('Error al obtener deportes:', error);
    throw error;
  }
};

/**
 * Listar ubicaciones disponibles
 * @returns {Promise<Array>}
 */
export const getLocations = async () => {
  try {
    const response = await api.get('/api/explorar/ubicaciones');
    return response.data;
  } catch (error) {
    console.error('Error al obtener ubicaciones:', error);
    throw error;
  }
};


// ===========================================
// 2. REDUX SLICE (explorarSlice.js)
// ===========================================

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as searchService from '../services/searchService';

// Thunks
export const fetchCourts = createAsyncThunk(
  'explorar/fetchCourts',
  async (filters, { rejectWithValue }) => {
    try {
      const response = await searchService.searchCourts(filters);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchCourtsWithPagination = createAsyncThunk(
  'explorar/fetchCourtsWithPagination',
  async ({ filters, page, limit }, { rejectWithValue }) => {
    try {
      const response = await searchService.searchCourtsWithPagination(filters, page, limit);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchSports = createAsyncThunk(
  'explorar/fetchSports',
  async (_, { rejectWithValue }) => {
    try {
      const response = await searchService.getSports();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchLocations = createAsyncThunk(
  'explorar/fetchLocations',
  async (_, { rejectWithValue }) => {
    try {
      const response = await searchService.getLocations();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const explorarSlice = createSlice({
  name: 'explorar',
  initialState: {
    // Búsqueda
    courts: [],
    loading: false,
    error: null,
    
    // Paginación
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false
    },
    
    // Filtros aplicados
    filters: {},
    
    // Listas para filtros
    sports: [],
    locations: [],
    
    // UI state
    searchText: '',
    selectedSport: null,
    selectedLocation: null
  },
  reducers: {
    setSearchText: (state, action) => {
      state.searchText = action.payload;
    },
    setSelectedSport: (state, action) => {
      state.selectedSport = action.payload;
    },
    setSelectedLocation: (state, action) => {
      state.selectedLocation = action.payload;
    },
    setFilters: (state, action) => {
      state.filters = action.payload;
    },
    clearFilters: (state) => {
      state.filters = {};
      state.searchText = '';
      state.selectedSport = null;
      state.selectedLocation = null;
    },
    setPage: (state, action) => {
      state.pagination.page = action.payload;
    }
  },
  extraReducers: (builder) => {
    // Fetch Courts
    builder
      .addCase(fetchCourts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCourts.fulfilled, (state, action) => {
        state.loading = false;
        state.courts = action.payload.data;
        state.filters = action.payload.filters;
      })
      .addCase(fetchCourts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
    
    // Fetch Courts with Pagination
    builder
      .addCase(fetchCourtsWithPagination.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCourtsWithPagination.fulfilled, (state, action) => {
        state.loading = false;
        state.courts = action.payload.data;
        state.pagination = action.payload.pagination;
        state.filters = action.payload.filters;
      })
      .addCase(fetchCourtsWithPagination.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
    
    // Fetch Sports
    builder
      .addCase(fetchSports.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchSports.fulfilled, (state, action) => {
        state.loading = false;
        state.sports = action.payload.data;
      })
      .addCase(fetchSports.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
    
    // Fetch Locations
    builder
      .addCase(fetchLocations.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchLocations.fulfilled, (state, action) => {
        state.loading = false;
        state.locations = action.payload.data;
      })
      .addCase(fetchLocations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const {
  setSearchText,
  setSelectedSport,
  setSelectedLocation,
  setFilters,
  clearFilters,
  setPage
} = explorarSlice.actions;

export default explorarSlice.reducer;


// ===========================================
// 3. COMPONENTE DE BÚSQUEDA (SearchScreen.js)
// ===========================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchCourts,
  fetchSports,
  fetchLocations,
  setSearchText,
  setSelectedSport,
  clearFilters
} from '../store/slices/explorarSlice';

const SearchScreen = () => {
  const dispatch = useDispatch();
  const {
    courts,
    loading,
    error,
    sports,
    searchText,
    selectedSport
  } = useSelector((state) => state.explorar);

  const [localSearchText, setLocalSearchText] = useState('');

  useEffect(() => {
    // Cargar deportes al montar el componente
    dispatch(fetchSports());
    dispatch(fetchLocations());
  }, []);

  const handleSearch = () => {
    const filters = {
      q: localSearchText,
      sport_id: selectedSport?.id
    };
    dispatch(setSearchText(localSearchText));
    dispatch(fetchCourts(filters));
  };

  const handleSportSelect = (sport) => {
    dispatch(setSelectedSport(sport));
    const filters = {
      q: searchText,
      sport_id: sport.id
    };
    dispatch(fetchCourts(filters));
  };

  const renderCourtItem = ({ item }) => (
    <TouchableOpacity style={styles.courtCard}>
      <Text style={styles.courtName}>{item.nombre}</Text>
      <Text style={styles.complexName}>{item.complejo?.nombre}</Text>
      <Text style={styles.location}>{item.complejo?.ubicacion}</Text>
      <Text style={styles.sport}>{item.sport?.name}</Text>
      <Text style={styles.price}>${item.precio_hora}/hora</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Barra de búsqueda */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar canchas..."
          value={localSearchText}
          onChangeText={setLocalSearchText}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearch}
        >
          <Text style={styles.searchButtonText}>Buscar</Text>
        </TouchableOpacity>
      </View>

      {/* Filtros de deporte */}
      <FlatList
        horizontal
        data={sports}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.sportChip,
              selectedSport?.id === item.id && styles.sportChipSelected
            ]}
            onPress={() => handleSportSelect(item)}
          >
            <Text
              style={[
                styles.sportChipText,
                selectedSport?.id === item.id && styles.sportChipTextSelected
              ]}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
        style={styles.sportsList}
        showsHorizontalScrollIndicator={false}
      />

      {/* Lista de resultados */}
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" />
      ) : error ? (
        <Text style={styles.errorText}>Error: {error}</Text>
      ) : (
        <FlatList
          data={courts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderCourtItem}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No se encontraron canchas</Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16
  },
  searchBar: {
    flexDirection: 'row',
    marginBottom: 16
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8
  },
  searchButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 8
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  sportsList: {
    marginBottom: 16
  },
  sportChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8
  },
  sportChipSelected: {
    backgroundColor: '#007AFF'
  },
  sportChipText: {
    color: '#333'
  },
  sportChipTextSelected: {
    color: '#fff',
    fontWeight: 'bold'
  },
  courtCard: {
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 12
  },
  courtName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4
  },
  complexName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4
  },
  location: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4
  },
  sport: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 4
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50'
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 20
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#999'
  }
});

export default SearchScreen;


// ===========================================
// 4. HOOK PERSONALIZADO (useSearch.js)
// ===========================================

import { useState, useEffect } from 'react';
import { searchCourts } from '../services/searchService';

/**
 * Hook personalizado para búsqueda de canchas
 */
export const useSearch = (initialFilters = {}) => {
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);

  const search = async (newFilters = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const mergedFilters = { ...filters, ...newFilters };
      setFilters(mergedFilters);
      
      const response = await searchCourts(mergedFilters);
      setCourts(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setCourts([]);
    setFilters({});
    setError(null);
  };

  return {
    courts,
    loading,
    error,
    filters,
    search,
    clearSearch
  };
};


// ===========================================
// 5. EJEMPLO DE USO CON PAGINACIÓN
// ===========================================

const PaginatedSearchScreen = () => {
  const [courts, setCourts] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const response = await searchCourtsWithPagination(
        { deporte: 'futbol' },
        page,
        10
      );
      
      setCourts([...courts, ...response.data]);
      setHasMore(response.pagination.hasNext);
      setPage(page + 1);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FlatList
      data={courts}
      renderItem={renderCourtItem}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        loading ? <ActivityIndicator /> : null
      }
    />
  );
};


// ===========================================
// 6. INTEGRACIÓN CON DEBOUNCE
// ===========================================

import { useCallback } from 'react';
import debounce from 'lodash.debounce';

const SearchWithDebounce = () => {
  const [searchResults, setSearchResults] = useState([]);

  // Búsqueda con debounce de 500ms
  const debouncedSearch = useCallback(
    debounce(async (text) => {
      if (text.length < 3) return;
      
      try {
        const response = await searchCourts({ q: text });
        setSearchResults(response.data);
      } catch (error) {
        console.error(error);
      }
    }, 500),
    []
  );

  const handleTextChange = (text) => {
    debouncedSearch(text);
  };

  return (
    <TextInput
      placeholder="Buscar..."
      onChangeText={handleTextChange}
    />
  );
};
