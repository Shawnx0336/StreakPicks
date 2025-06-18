// @ts-nocheck

'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, push, serverTimestamp, off } from 'firebase/database';

// Firebase configuration - USE THIS EXACT CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDV6qrKInWWQ-w81p6TiZqwEw3kYEBTpR8",
  authDomain: "streakpicks-2a21a.firebaseapp.com",
  databaseURL: "https://streakpicks-2a21a-default-rtdb.firebaseio.com",
  projectId: "streakpicks-2a21a",
  storageBucket: "streakpicks-2a21a.appspot.com",
  messagingSenderId: "472855085588",
  appId: "1:472855085588:web:7c2013e37572864fe29d01"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// --- REAL useWhop Hook for Whop OAuth authentication ---
const useWhop = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [hasAccess, setHasAccess] = useState(false);
    const [error, setError] = useState(null);
    const [isClient, setIsClient] = useState(false);

    // Fix hydration issues by ensuring we're on the client
    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!isClient) return; // Don't run on server

        const checkAuthStatus = async () => {
            try {
                // Method 1: Try to get current user from Whop API
                try {
                    const response = await fetch('/api/whop/user', {
                        method: 'GET',
                        credentials: 'include',
                        headers: {
                            'Cache-Control': 'no-cache',
                            'Content-Type': 'application/json'
                        }
                    });

                    if (response.ok) {
                        const userData = await response.json();
                        console.log('✅ Whop user authenticated:', userData);
                        setUser(userData);
                        setIsAuthenticated(true);
                        setHasAccess(true);
                        setError(null);
                        setIsLoading(false);
                        return;
                    }
                } catch (whopError) {
                    console.log('Whop API not available, checking fallback...');
                }

                // Method 2: Fallback to original auth check
                const fallbackResponse = await fetch('/api/auth/check', {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Cache-Control': 'no-cache'
                    }
                });

                if (fallbackResponse.ok) {
                    const userData = await fallbackResponse.json();
                    console.log('✅ Fallback auth successful:', userData);
                    setUser(userData);
                    setIsAuthenticated(true);
                    setHasAccess(true);
                    setError(null);
                } else if (fallbackResponse.status === 401) {
                    // User not authenticated - create test user for development
                    console.log('🧪 Creating test user for development');
                    const testUser = {
                        id: 'test_user_' + Math.random().toString(36).substr(2, 9),
                        username: 'TestUser',
                        name: 'Test User',
                        email: 'test@example.com',
                        isTestUser: true
                    };
                    setUser(testUser);
                    setIsAuthenticated(true);
                    setHasAccess(true);
                    setError(null);
                } else {
                    throw new Error(`Authentication check failed: ${fallbackResponse.status}`);
                }
            } catch (err) {
                console.error('Auth check error:', err);
                
                // Final fallback - create anonymous test user
                console.log('🧪 Creating anonymous test user');
                const anonymousUser = {
                    id: 'anonymous_' + Math.random().toString(36).substr(2, 9),
                    username: 'AnonymousUser',
                    name: 'Anonymous User',
                    email: 'anonymous@example.com',
                    isTestUser: true,
                    isAnonymous: true
                };
                setUser(anonymousUser);
                setIsAuthenticated(true);
                setHasAccess(true);
                setError(null);
            } finally {
                setIsLoading(false);
            }
        };

        checkAuthStatus();
    }, [isClient]);

    // Show loading until client-side hydration is complete
    if (!isClient) {
        return { user: null, isAuthenticated: false, isLoading: true, hasAccess: false, error: null };
    }

    return { user, isAuthenticated, isLoading, hasAccess, error };
};
// --- END REAL useWhop Hook ---

// --- Imports & Types ---
/**
 * @typedef {'dark' | 'light'} Theme
 */

/**
 * @typedef {Object} WeeklyStats
 * @property {number} picks - Total picks made this week.
 * @property {number} correct - Total correct picks this week.
 * @property {string | null} weekStart - `toDateString()` of the Monday of the current week.
 */

/**
 * @typedef {Object} UserState
 * @property {number} currentStreak - Current consecutive correct picks.
 * @property {number} bestStreak - All-time best consecutive correct picks.
 * @property {number} totalPicks - Total picks made.
 * @property {number} correctPicks - Total correct picks.
 * @property {Object | null} todaysPick - Details of today's pick: { matchupId, selectedTeam, timestamp, date, bet }."
 * @property {string | null} lastPickDate - `toDateString()` of the last date a pick was made.
 * @property {Theme} theme - Current UI theme ('dark' or 'light').
 * @property {boolean} soundEnabled - Is sound enabled?
 * @property {string} displayName - User's display name from Whop account.
 * @property {boolean} isPublic - Whether user data can appear on leaderboard.
 * @property {WeeklyStats} weeklyStats - Stats for the current week.
 * @property {number} coins - User's current coin balance.
 * @property {number} totalCoinsEarned - Total coins earned throughout all time.
 * @property {number} totalCoinsSpent - Total coins spent throughout all time.
 * @property {string | null} lastDailyBonus - ISO string of the last date daily bonus was claimed.
 * @property {Array<Object>} bettingHistory - History of bets made.
 * @property {Array<Object>} pickHistoryData - Detailed history of all picks made, including results.
 * @property {Array<string>} achievements - IDs of unlocked achievements.
 */

/**
 * @typedef {Object} Team
 * @property {string} name - Full team name.
 * @property {string} abbr - Team abbreviation.
 * @property {string} logo - Emoji logo for the sport.
 * @property {string[]} colors - Primary and secondary team colors (hex codes).
 */

/**
 * @typedef {Object} Matchup
 * @property {string} id - Unique matchup ID.
 * @property {Team} homeTeam - Home team details.
 * @property {Team} awayTeam - Away Team details.
 * @property {string} sport - Sport type (e.e., 'NBA', 'NFL', 'MLB', 'NHL', 'Soccer', 'NCAAB').
 * @property {string} venue - Venue name.
 * @property {string} startTime - Matchup start time (ISO string).
 * @property {string} status - Current status of the matchup (e.g., 'upcoming').
 */

/**
 * @typedef {Object} Notification
 * @property {string} id - Unique notification ID.
 * @property {string} message - Notification message.
 * @property {'info' | 'success' | 'warning' | 'error'} type - Type of notification.
 * @property {boolean} isRead - Has the user read it?
 * @property {Date} timestamp - When was it created?
 */

/**
 * @typedef {Object} LeaderboardEntry
 * @property {string} id - Hashed user ID.
 * @property {string} displayName - Generated anonymous name.
 * @property {number} currentStreak - User's current streak.
 * @property {number} bestStreak - User's best streak.
 * @property {number} totalPicks - User's total picks.
 * @property {number} correctPicks - Total correct picks.
 * @property {number} accuracy - User's accuracy percentage.
 * @property {string} lastActive - ISO string of last active date.
 * @property {number} weeklyWins - This week's correct picks.
 */

/**
 * @typedef {Object} LeaderboardData
 * @property {LeaderboardEntry[]} users - Array of top users.
 * @property {number | null} userRank - Current user's rank.
 * @property {string | null} lastUpdated - ISO string of last update time.
 */

/**
 * @typedef {Object} Achievement
 * @property {string} id - Unique ID.
 * @property {string} title - Display title.
 * @property {string} description - Description.
 * @property {string} emoji - Emoji icon.
 * @property {number} coinReward - Coins awarded for unlocking.
 * @property {function(UserState): boolean} checkCondition - Function to check if unlocked.
 */


// --- Utility Functions ---

/**
 * Simple string hashing function for consistent anonymous IDs.
 * @param {string | null | undefined} str - Input string.
 * @returns {number} Numeric hash.
 */
const simpleHash = (str) => {
    let hash = 0;
    if (str === null || str === undefined) { // Handle null or undefined string input
        str = '';
    }
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
};

/**
 * Generates an anonymous but consistent display name based on userId.
 * @param {string} userId - The user's unique ID.
 * @returns {string} Generated display name.
 */
const generateDisplayName = (userId) => {
    const adjectives = ['Fire', 'Ice', 'Lightning', 'Storm', 'Steel', 'Shadow', 'Blazing', 'Mighty', 'Swift', 'Golden', 'Mystic', 'Crimson', 'Azure', 'Jade', 'Silver', 'Bronze', 'Diamond', 'Emerald', 'Vapor', 'Echo'];
    const nouns = ['Picker', 'Prophet', 'Analyst', 'Streak', 'Eagle', 'Tiger', 'Champion', 'Master', 'Wizard', 'Legend', 'Striker', 'Scout', 'Oracle', 'Hunter', 'Guardian', 'Titan', 'Specter', 'Vanguard', 'Pioneer', 'Maverick'];

    // Use userId hash to ensure consistent name
    const hashVal = simpleHash(userId);
    const adjIndex = hashVal % adjectives.length;
    const nounIndex = Math.floor(hashVal / adjectives.length) % nouns.length;
    const number = (Math.floor(hashVal / (adjectives.length * nouns.length)) % 999) + 1; // 1 to 999

    return `${adjectives[adjIndex]}${nouns[nounIndex]}${number}`;
};

/**
 * Gets the ISO string for the Monday of the current week.
 * @returns {string} ISO date string for the start of the week.
 */
const getMondayOfCurrentWeek = () => {
    const today = new Date();
    const day = today.getDay(); // 0 for Sunday, 1 for Monday, etc.
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday (make it -6)
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0); // Set to start of the day
    return monday.toISOString();
};

/**
 * Gets the display name from Whop user account
 * @param {Object} user - Whop user object
 * @returns {string} Display name to use
 */
const getDisplayName = (user) => {
    if (!user) return 'AnonymousUser';
    
    // Handle test users
    if (user.isTestUser || user.isAnonymous) {
        return user.username || user.name || 'TestUser';
    }
    
    // Handle real Whop users with proper fallbacks
    return user.username || 
           user.name || 
           user.email?.split('@')[0] || 
           `WhopUser${simpleHash(user.id || 'anonymous')}`;
};

/**
 * Checks if a Date object is valid.
 * @param {Date} date - The Date object to check.
 * @returns {boolean} True if the date is valid, false otherwise.
 */
const isValidDate = (date) => {
    return date instanceof Date && !isNaN(date.getTime());
};

/**
 * Safely parses a date input into a Date object, returning null if invalid.
 * @param {*} dateInput - The input to parse (e.g., string, number, Date object).
 * @returns {Date | null} A valid Date object or null.
 */
const safeParseDate = (dateInput) => {
    if (!dateInput) return null;
    
    const date = new Date(dateInput);
    return isValidDate(date) ? date : null;
};


// MLB Team Colors
const getMLBTeamData = (teamName) => {
    const teamData = {
        // American League East
        'Baltimore Orioles': { colors: ['DF4601', '000000'], logo: '🐦', abbr: 'BAL' },
        'Boston Red Sox': { colors: ['BD3039', '0C2340'], logo: '🧦', abbr: 'BOS' },
        'New York Yankees': { colors: ['132448', 'C4CED4'], logo: '🎩', abbr: 'NYY' },
        'Tampa Bay Rays': { colors: ['092C5C', '8FBCE6'], logo: '☀️', abbr: 'TB' },
        'Toronto Blue Jays': { colors: ['134A8E', 'E8291C'], logo: '🍁', abbr: 'TOR' },
        
        // American League Central
        'Chicago White Sox': { colors: ['000000', 'C4CED4'], logo: '⚫', abbr: 'CWS' },
        'Cleveland Guardians': { colors: ['E31937', '0C2340'], logo: '🛡️', abbr: 'CLE' },
        'Detroit Tigers': { colors: ['0C2340', 'FA4616'], logo: '🐅', abbr: 'DET' },
        'Kansas City Royals': { colors: ['004687', 'BD9B60'], logo: '👑', abbr: 'KC' },
        'Minnesota Twins': { colors: ['002B5C', 'D31145'], logo: '⭐', abbr: 'MIN' },
        
        // American League West
        'Houston Astros': { colors: ['002D62', 'EB6E1F'], logo: '🚀', abbr: 'HOU' },
        'Los Angeles Angels': { colors: ['BA0021', '003263'], logo: '😇', abbr: 'LAA' },
        'Oakland Athletics': { colors: ['003831', 'EFB21E'], logo: '🅰️', abbr: 'OAK' },
        'Seattle Mariners': { colors: ['0C2C56', '005C5C'], logo: '🔱', abbr: 'SEA' },
        'Texas Rangers': { colors: ['003278', 'C0111F'], logo: '🤠', abbr: 'TEX' },
        
        // National League East
        'Atlanta Braves': { colors: ['CE1141', '13274F'], logo: '🪓', abbr: 'ATL' },
        'Miami Marlins': { colors: ['00A3E0', 'EF3340'], logo: '🐟', abbr: 'MIA' },
        'New York Mets': { colors: ['002D72', 'FF5910'], logo: '🏙️', abbr: 'NYM' },
        'Philadelphia Phillies': { colors: ['E81828', '002D72'], logo: '🔔', abbr: 'PHI' },
        'Washington Nationals': { colors: ['AB0003', '14225A'], logo: '🦅', abbr: 'WSH' },
        
        // National League Central
        'Chicago Cubs': { colors: ['0E3386', 'CC3433'], logo: '🐻', abbr: 'CHC' },
        'Cincinnati Reds': { colors: ['C6011F', '000000'], logo: '🔴', abbr: 'CIN' },
        'Milwaukee Brewers': { colors: ['FFC52F', '12284B'], logo: '🍺', abbr: 'MIL' },
        'Pittsburgh Pirates': { colors: ['FDB827', '27251F'], logo: '☠️', abbr: 'PIT' },
        'St. Louis Cardinals': { colors: ['C41E3A', '0C2340'], logo: '🐦', abbr: 'STL' },
        
        // National League West
        'Arizona Diamondbacks': { colors: ['A71930', 'E3D4AD'], logo: '🐍', abbr: 'ARI' },
        'Colorado Rockies': { colors: ['33006F', 'C4CED4'], logo: '⛰️', abbr: 'COL' },
        'Los Angeles Dodgers': { colors: ['005A9C', 'EF3E42'], logo: '💫', abbr: 'LAD' },
        'San Diego Padres': { colors: ['2F241D', 'FFC425'], logo: '🏄‍♂️', abbr: 'SD' },
        'San Francisco Giants': { colors: ['FD5A1E', '27251F'], logo: '🌉', abbr: 'SF' }
    };
    
    console.log('🔍 Looking for team data for:', teamName);
    
    const data = teamData[teamName];
    if (!data) {
        console.error('❌ NO TEAM DATA FOUND for:', teamName);
        console.log('📋 Available teams:', Object.keys(teamData));
        return { colors: ['FF0000', '00FF00'], logo: '❓', abbr: 'UNK' };
    }
    
    console.log('✅ Found team data for', teamName, ':', data);
    return data;
};

/**
 * Modified getTodaysMLBGame to getTodaysMLBGames
 * Returns an array of up to 2 MLB games (early and late).
 * If only one or no suitable games, returns an array with 1 game or empty array.
 */
const getTodaysMLBGames = async () => {
    console.log('🎯 US-TIME-BASED API CALL - STARTING');
    
    // Always use US Eastern Time for determining "game day"
    const usEasternTime = new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
    const usDate = new Date(usEasternTime);
    
    const year = usDate.getFullYear();
    const month = String(usDate.getMonth() + 1).padStart(2, '0');
    const day = String(usDate.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    console.log(`🇺🇸 Fetching games for US Eastern date: ${today} (universal for all users)`);

    const apiUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}`;
    
    try {
        const response = await fetch(apiUrl, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`MLB API returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data?.dates?.[0]?.games?.length) {
            console.log(`No MLB games found for ${today}`);
            return []; // Return empty array if no games
        }
        
        const allGames = data.dates[0].games;
        
        // Filter for early and late games
        const selectedGames = [];

// Just take the first 2 games available for the day
if (allGames.length >= 2) {
    selectedGames.push(allGames[0], allGames[allGames.length - 1]);
} else if (allGames.length === 1) {
    selectedGames.push(allGames[0]);
}
// If no games, selectedGames stays empty
        
        const formattedGames = selectedGames.map(game => {
            const homeTeamData = getMLBTeamData(game.teams.home.team.name);
            const awayTeamData = getMLBTeamData(game.teams.away.team.name);
            
            return {
                id: game.gamePk.toString(),
                homeTeam: {
                    name: game.teams.home.team.name,
                    abbr: homeTeamData.abbr,
                    logo: homeTeamData.logo,
                    colors: homeTeamData.colors 
                },
                awayTeam: {
                    name: game.teams.away.team.name,
                    abbr: awayTeamData.abbr,  
                    logo: awayTeamData.logo, 
                    colors: awayTeamData.colors 
                },
                sport: 'MLB',
                venue: game.venue?.name || 'MLB Stadium',
                startTime: new Date(game.gameDate).toISOString(),
                status: 'upcoming'
            };
        });

        console.log('🎯 Selected games:', formattedGames.map(g => `${g.homeTeam.abbr} vs ${g.awayTeam.abbr}`).join(', '));
        return formattedGames;
        
    } catch (error) {
        console.error('❌ MLB API FAILED:', error); 
        throw error;
    }
};

/**
 * Helper function to get team abbreviation from team name
 * This is needed for the new fetchMLBGameResult to map full names to abbreviations.
 */
function getTeamAbbreviation(teamName) {
    const teamAbbrs = {
        'Philadelphia Phillies': 'PHI',
        'Miami Marlins': 'MIA',
        'Colorado Rockies': 'COL',
        'Washington Nationals': 'WSH',
        'Los Angeles Angels': 'LAA',
        'New York Yankees': 'NYY',
        'Baltimore Orioles': 'BAL',
        'Tampa Bay Rays': 'TB',
        'Boston Red Sox': 'BOS',
        'Seattle Mariners': 'SEA',
        'Houston Astros': 'HOU',
        'Athletics': 'OAK',
        'San Diego Padres': 'SD',
        'Los Angeles Dodgers': 'LAD',
        'Atlanta Braves': 'ATL',
        'New York Mets': 'NYM',
        'Chicago Cubs': 'CHC',
        'Milwaukee Brewers': 'MIL',
        'Cincinnati Reds': 'CIN',
        'Pittsburgh Pirates': 'PIT',
        'St. Louis Cardinals': 'STL',
        'Arizona Diamondbacks': 'ARI',
        'San Francisco Giants': 'SF',
        'Texas Rangers': 'TEX',
        'Kansas City Royals': 'KC',
        'Minnesota Twins': 'MIN',
        'Chicago White Sox': 'CWS',
        'Cleveland Guardians': 'CLE',
        'Detroit Tigers': 'DET',
        'Toronto Blue Jays': 'TOR'
    };
    
    return teamAbbrs[teamName] || teamName.split(' ').pop().slice(0, 3).toUpperCase();
}


/**
 * FIXED: Get game results from the schedule API using the GAME'S date, not today's date
 * @param {string} gameId - MLB game ID (gamePk)
 * @param {string} sport - Sport type (should be 'MLB')
 * @param {string} gameDate - The actual date of the game (ISO string from todaysMatchup.startTime)
 * @returns {Promise<Object|null>} Game result or null
 */
const fetchMLBGameResult = async (gameId, sport, gameDate) => {
    try {
        console.log(`🔍 Fetching MLB game result for game ${gameId}`);
        
        // ✅ FIX: Use the game's actual date, not today's date
        let searchDate;
        if (gameDate) {
            // Extract date from the game's startTime
            searchDate = new Date(gameDate).toISOString().split('T')[0]; //YYYY-MM-DD format
        } else {
            // Fallback to today if no gameDate provided
            searchDate = new Date().toISOString().split('T')[0];
        }
        
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${searchDate}`;
        
        console.log(`📡 Fetching from schedule API for date ${searchDate}: ${scheduleUrl}`);
        
        const response = await fetch(proxyUrl + encodeURIComponent(scheduleUrl));
        
        if (!response.ok) {
            console.log(`❌ Schedule API returned ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        
        // Find the specific game by ID
        const game = data.dates?.[0]?.games?.find(g => g.gamePk.toString() === gameId.toString());
        
        if (!game) {
            console.log(`❌ Game ${gameId} not found in ${searchDate} schedule`);
            return null;
        }
        
        // Check if game is finished
        if (game.status?.statusCode !== 'F') {
            console.log(`⏳ Game ${gameId} not finished yet. Status: ${game.status?.detailedState}`);
            return null;
        }
        
        // Extract scores and winner info (it's right there in the schedule!)
        const homeScore = game.teams.home.score || 0;
        const awayScore = game.teams.away.score || 0;
        const homeWon = game.teams.home.isWinner || false;
        const awayWon = game.teams.away.isWinner || false;
        
        let winner = 'tie';
        if (homeWon) winner = 'home';
        else if (awayWon) winner = 'away';
        
        const result = {
            gameId: gameId,
            status: 'completed',
            homeScore: homeScore,
            awayScore: awayScore,
            winner: winner,
            homeTeam: {
                name: game.teams.home.team.name,
                abbreviation: getTeamAbbreviation(game.teams.home.team.name),
                score: homeScore
            },
            awayTeam: {
                name: game.teams.away.team.name,
                abbreviation: getTeamAbbreviation(game.teams.away.team.name),
                score: awayScore
            },
            completedAt: new Date(),
            rawGameData: game
        };
        
        console.log('✅ Successfully parsed game result from schedule:', {
            gameId,
            searchDate,
            homeScore,
            awayScore,
            winner,
            homeTeam: result.homeTeam.name,
            awayTeam: result.awayTeam.name
        });
        
        return result;
        
    } catch (error) {
        console.error(`❌ Error fetching game result for ${gameId}:`, error.message);
        return null;
    }
};


// --- Custom Hooks ---

/**
 * useLocalStorage hook for persistent state management using window.localStorage.
 * Modified to accept a userId for key personalization.
 * FIXED VERSION - prevents infinite re-render loop
 * @param {string} keyPrefix - The prefix for local storage key (e.g., 'streakPickemUser').
 * @param {any} initialValue - Initial value if nothing in storage.
 * @param {string | null} userId - The user's unique ID from Whop. If null, uses a generic key.
 * @returns {[any, (value: any) => void]} - Value and setter.
 */
const useLocalStorage = (keyPrefix, initialValue, userId) => {
    // Construct a user-specific key, or a generic one if no user ID is available
    const storageKey = userId ? `${keyPrefix}_${userId}` : keyPrefix;

    const [storedValue, setStoredValue] = useState(() => {
        // Check if we're in the browser (client-side)
        if (typeof window === 'undefined') {
            return initialValue;
        }

        try {
            const item = window.localStorage.getItem(storageKey);
            let parsedItem = item ? JSON.parse(item) : initialValue;

            // Handle date-based resets for userState only
            if (keyPrefix === 'streakPickemUser') {
                let updatedParsedItem = { ...parsedItem };
                
                // FORCE consistent date comparison using local date
                const now = new Date();
                const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const storedDate = updatedParsedItem.lastPickDate;
                
                console.log('Date comparison for reset:', { currentDate, storedDate, different: storedDate !== currentDate });

                // Reset todaysPick and update lastPickDate if it's a new day
                if (storedDate !== currentDate) {
                    console.log('🔄 Resetting picks for new day');
                    updatedParsedItem.todaysPick = null;
                    updatedParsedItem.lastPickDate = currentDate;
                }

                // Reset weekly stats if it's a new week
                const currentWeekMonday = getMondayOfCurrentWeek();
                if (!updatedParsedItem.weeklyStats || updatedParsedItem.weeklyStats.weekStart !== currentWeekMonday) {
                    updatedParsedItem.weeklyStats = {
                        picks: 0,
                        correct: 0,
                        weekStart: currentWeekMonday
                    };
                }
                // Ensure coins and achievement states are initialized if missing in old state
                if (typeof updatedParsedItem.coins === 'undefined') updatedParsedItem.coins = initialValue.coins;
                if (typeof updatedParsedItem.totalCoinsEarned === 'undefined') updatedParsedItem.totalCoinsEarned = initialValue.totalCoinsEarned;
                if (typeof updatedParsedItem.totalCoinsSpent === 'undefined') updatedParsedItem.totalCoinsSpent = initialValue.totalCoinsSpent;
                if (typeof updatedParsedItem.lastDailyBonus === 'undefined') updatedParsedItem.lastDailyBonus = initialValue.lastDailyBonus;
                if (typeof updatedParsedItem.bettingHistory === 'undefined') updatedParsedItem.bettingHistory = initialValue.bettingHistory;
                if (typeof updatedParsedItem.achievements === 'undefined') updatedParsedItem.achievements = initialValue.achievements;
                if (typeof updatedParsedItem.pickHistoryData === 'undefined') updatedParsedItem.pickHistoryData = initialValue.pickHistoryData;


                return updatedParsedItem;
            }

            return parsedItem;
        } catch (error) {
            console.error(`Error reading from localStorage for key ${storageKey}`, error);
            return initialValue;
        }
    });

    const setValue = useCallback((value) => {
        // Check if we're in the browser (client-side)
        if (typeof window === 'undefined') {
            return;
        }

        try {
            // ALWAYS use functional update for setStoredValue to get the latest state
            setStoredValue(prevStoredValue => {
                const valueToStore = value instanceof Function ? value(prevStoredValue) : value;
                window.localStorage.setItem(storageKey, JSON.stringify(valueToStore));
                return valueToStore;
            });
        } catch (error) {
            console.error(`Error saving to localStorage for key ${storageKey}`, error);
        }
    }, [storageKey]);

    // FIXED: Remove this useEffect that was causing infinite re-renders
    // The original useEffect was re-running every time userId changed and calling setStoredValue,
    // which triggered a re-render, which caused the effect to run again, creating an infinite loop.

    // Instead, we'll handle userId changes differently using a ref to track the previous userId
    const prevUserIdRef = useRef(userId);

    useEffect(() => {
        // Only reload if userId actually changed (not on every render)
        if (prevUserIdRef.current !== userId) {
            prevUserIdRef.current = userId;

            // Only reload state if we're in the browser
            if (typeof window !== 'undefined') {
                try {
                    const newStorageKey = userId ? `${keyPrefix}_${userId}` : keyPrefix;
                    const item = window.localStorage.getItem(newStorageKey);
                    const newValue = item ? JSON.parse(item) : initialValue;
                    setStoredValue(newValue);
                } catch (error) {
                    console.error(`Error reloading state for key ${storageKey} on userId change`, error);
                    setStoredValue(initialValue);
                }
            }
        }
    }, [userId, keyPrefix, initialValue, storageKey]); // Dependencies are stable now

    return [storedValue, setValue];
};

/**
 * useSound hook for basic audio management.
 * @param {boolean} soundEnabled - Whether sound is globally enabled.
 * @returns {{playSound: (soundName: string) => void}}
 */
const useSound = (soundEnabled) => {
    const audioContext = useRef(null);
    const sounds = useRef({});

    useEffect(() => {
        if (!soundEnabled) {
            if (audioContext.current) {
                audioContext.current.close();
                audioContext.current = null;
            }
            return;
        }

        // Initialize AudioContext if not already
        if (typeof window !== 'undefined' && !audioContext.current) {
            try {
                audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('AudioContext not supported:', e);
            }
        }

        // Create a dummy buffer for all sounds instead of fetching actual files
        // This prevents 'Failed to parse URL' errors in environments without direct file access.
        if (audioContext.current) {
            const buffer = audioContext.current.createBuffer(1, audioContext.current.sampleRate * 0.1, audioContext.current.sampleRate);
            sounds.current['pick_select'] = buffer;
            sounds.current['pick_correct'] = buffer;
            sounds.current['pick_wrong'] = buffer;
            sounds.current['achievement_unlock'] = buffer;
            sounds.current['notification'] = buffer;
            sounds.current['button_click'] = buffer; // Generic click sound
            sounds.current['coin_collect'] = buffer; // New sound for coins
        }

        // Cleanup AudioContext on unmount
        return () => {
            if (audioContext.current) {
                audioContext.current.close();
                audioContext.current = null;
            }
        };
    }, [soundEnabled]);

    const playSound = useCallback((soundName) => {
        if (!soundEnabled || !audioContext.current || !sounds.current[soundName]) {
            return;
        }
        try {
            const source = audioContext.current.createBufferSource();
            source.buffer = sounds.current[soundName];
            source.connect(audioContext.current.destination);
            source.start(0);
        } catch (e) {
            console.error(`Error playing sound ${soundName}:`, e);
        }
    }, [soundEnabled]);

    return { playSound };
};


/**
 * useNotifications hook for managing in-app notifications.
 * @returns {{notifications: Notification[], addNotification: (notification: Notification) => void, dismissNotification: (id: string) => void}}
 */
const useNotifications = () => {
    const [notifications, setNotifications] = useState([]);

    const addNotification = useCallback((newNotification) => {
        const notificationWithId = { ...newNotification, id: newNotification.id || crypto.randomUUID(), timestamp: new Date() };
        setNotifications((prev) => [...prev, notificationWithId]);
        // Auto-dismiss after some time for 'info' and 'success'
        if (newNotification.type === 'info' || newNotification.type === 'success') {
            setTimeout(() => dismissNotification(notificationWithId.id), 5000);
        }
    }, []);

    const dismissNotification = useCallback((id) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    return { notifications, addNotification, dismissNotification };
};


/**
 * useFirebaseLeaderboard - REAL global leaderboard using Firebase
 * @param {UserState} userState - Current user's state
 * @param {string} userId - Whop user ID
 * @returns {{leaderboardData: LeaderboardData, updateLeaderboard: function, refreshLeaderboard: function}}
 */
const useFirebaseLeaderboard = (userState, userId) => {
    const [leaderboardData, setLeaderboardData] = useState({
        users: [],
        userRank: null,
        lastUpdated: null
    });

    const leaderboardRef = ref(database, 'leaderboard');
    const isListening = useRef(false);

    // Real-time listener for leaderboard updates
    useEffect(() => {
        if (isListening.current) return; // Prevent duplicate listeners
        
        console.log('Setting up Firebase leaderboard listener...');
        isListening.current = true;

        const unsubscribe = onValue(leaderboardRef, (snapshot) => {
            try {
                const data = snapshot.val();
                console.log('Firebase data received:', data ? Object.keys(data).length : 0, 'users');

                if (data) {
                    // Convert Firebase object to array and sort
                    const usersArray = Object.values(data).map(user => ({
                        ...user,
                        lastActive: user.lastActive || new Date().toISOString()
                    }));

                    // Sort by current streak, then by best streak
                    usersArray.sort((a, b) => {
                        if (b.currentStreak !== a.currentStreak) {
                            return b.currentStreak - a.currentStreak;
                        }
                        return b.bestStreak - a.bestStreak;
                    });

                    // Calculate current user's rank
                    const userHashId = simpleHash(userId).toString();
                    const userRank = usersArray.findIndex(user => user.id === userHashId) + 1;

                    setLeaderboardData({
                        users: usersArray.slice(0, 50), // Top 50 for display
                        userRank: userRank || null,
                        lastUpdated: new Date().toISOString()
                    });

                    console.log(`Leaderboard updated: ${usersArray.length} users, your rank: ${userRank || 'unranked'}`);
                } else {
                    // No data in Firebase yet
                    setLeaderboardData({
                        users: [],
                        userRank: null,
                        lastUpdated: new Date().toISOString()
                    });
                    console.log('Empty leaderboard - be the first to compete!');
                }
            } catch (error) {
                console.error('Error processing Firebase leaderboard data:', error);
            }
        }, (error) => {
            console.error('Firebase listener error:', error);
        });

        // Cleanup listener on unmount
        return () => {
            console.log('Cleaning up Firebase leaderboard listener');
            unsubscribe();
            isListening.current = false;
        };
    }, [userId]);

    const updateLeaderboard = useCallback(async () => {
    // STRICT: Don't update if user data isn't ready OR if it's a test user
    if (!userState.displayName || 
        userState.displayName === 'AnonymousPicker' ||
        userId.includes('test_') || 
        userId.includes('anonymous_') || 
        userId.includes('fallback_') ||
        userId === 'anonymous' ||
        userId.length < 10) {
        console.log('🚫 Skipping leaderboard update for test/anonymous user:', userId);
        return;
    }

    const currentUserEntry = {
        id: simpleHash(userId).toString(),
        whopUserId: userId, // This will be validated by Firebase rules
        displayName: userState.displayName,
        currentStreak: userState.currentStreak, // Ensure these are included for update
        bestStreak: userState.bestStreak,
        totalPicks: userState.totalPicks,
        correctPicks: userState.correctPicks,
        accuracy: userState.totalPicks > 0 ? Math.round((userState.correctPicks / userState.totalPicks) * 100) : 0,
        weeklyWins: userState.weeklyStats.correct, // Assuming this is part of weekly stats
        lastActive: new Date().toISOString(),
    };

    try {
        const userRef = ref(database, `leaderboard/${currentUserEntry.id}`);
        await set(userRef, currentUserEntry);
        console.log(`✅ Updated Firebase leaderboard for REAL user: ${currentUserEntry.displayName}`);
    } catch (error) {
        console.error('❌ Firebase rejected leaderboard update (likely test user):', error);
    }
}, [userState, userId]);

    const refreshLeaderboard = useCallback(async () => {
        // Firebase automatically refreshes via real-time listener
        // This is just for UI consistency
        console.log('Leaderboard refresh requested (auto-synced via Firebase)');
        return Promise.resolve();
    }, []);

    return {
        leaderboardData,
        updateLeaderboard,
        refreshLeaderboard
    };
};

/**
 * useHapticFeedback hook for mobile haptic feedback.
 */
const useHapticFeedback = () => {
    const triggerFeedback = useCallback((type = 'light') => {
        if ('vibrate' in navigator) {
            const patterns = {
                light: [10],
                medium: [20],
                heavy: [30],
                success: [10, 50, 10],
                error: [100, 50, 100],
                pick_confirm: [15]
            };
            navigator.vibrate(patterns[type]);
        }
    }, []);
    return triggerFeedback;
};

/**
 * useSwipeGesture hook for swipe-to-select teams on mobile.
 * @param {function} onSwipeLeft - Callback for left swipe.
 * @param {function} onSwipeRight - Callback for right swipe.
 */
const useSwipeGesture = (onSwipeLeft, onSwipeRight) => {
    const startX = useRef(0);
    const endX = useRef(0);
    const threshold = 50; // Minimum distance for a swipe

    const onTouchStart = useCallback((e) => {
        startX.current = e.touches[0].clientX;
        endX.current = e.touches[0].clientX;
    }, []);

    const onTouchMove = useCallback((e) => {
        endX.current = e.touches[0].clientX;
    }, []);

    const onTouchEnd = useCallback(() => {
        const diff = startX.current - endX.current;
        if (diff > threshold) {
            onSwipeLeft();
        } else if (diff < -threshold) {
            onSwipeRight();
        }
    }, [onSwipeLeft, onSwipeRight]);

    return { onTouchStart, onTouchMove, onTouchEnd };
};


// --- Data Generation & Constants ---

const initialUserState = {
    currentStreak: 0,
    bestStreak: 0,
    totalPicks: 0,
    correctPicks: 0,
    todaysPick: null, // { matchupId, selectedTeam, timestamp, date, bet }
    lastPickDate: null,
    theme: 'dark',
    soundEnabled: true,
    displayName: 'WhopUser', // Will be set from Whop account
    isPublic: true,
    weeklyStats: {
        picks: 0,
        correct: 0,
        weekStart: null // Will be set to Monday of current week
    },
    coins: 500, // Starting coins
    totalCoinsEarned: 500,
    totalCoinsSpent: 0,
    lastDailyBonus: null, // ISO string of last bonus collection date
    bettingHistory: [], // Array of { matchupId, pickDate, selectedTeam, betAmount, won, winnings }
    pickHistoryData: [], // Detailed history of all picks made, including results.
    achievements: [] // Array of achievement IDs
};

/**
 * List of all defined achievements.
 * @type {Achievement[]}
 */
const ACHIEVEMENTS_LIST = [
    {
        id: 'streak_5',
        title: '5-Day Streaker',
        description: 'Achieve a 5-day winning streak!',
        emoji: '⚡',
        coinReward: 100,
        checkCondition: (userState) => userState.currentStreak >= 5
    },
    {
        id: 'streak_10',
        title: 'Double Digit Dominator',
        description: 'Reach a 10-day winning streak!',
        emoji: '🔥',
        coinReward: 250,
        checkCondition: (userState) => userState.currentStreak >= 10
    },
    {
        id: 'streak_20',
        title: 'Master Streaker',
        description: 'Hit an incredible 20-day winning streak!',
        emoji: '🏆',
        coinReward: 500,
        checkCondition: (userState) => userState.currentStreak >= 20
    },
    {
        id: 'coin_1k',
        title: 'Coin Collector I',
        description: 'Earn 1,000 total coins.',
        emoji: '💰',
        coinReward: 50,
        checkCondition: (userState) => userState.totalCoinsEarned >= 1000
    },
    {
        id: 'coin_5k',
        title: 'Coin King/Queen',
        description: 'Accumulate 5,000 total coins.',
        emoji: '👑',
        coinReward: 200,
        checkCondition: (userState) => userState.totalCoinsEarned >= 5000
    },
    {
        id: 'accuracy_70',
        title: 'Sharp Shooter',
        description: 'Achieve 70%+ accuracy over 10+ picks.',
        emoji: '🎯',
        coinReward: 100,
        checkCondition: (userState) => userState.totalPicks >= 10 && (userState.correctPicks / userState.totalPicks) >= 0.7
    },
    {
        id: 'high_roller',
        title: 'High Roller',
        description: 'Bet 100 coins and win!',
        emoji: '🤑',
        coinReward: 150,
        checkCondition: (userState) => userState.bettingHistory.some(b => b.betAmount === 100 && b.won)
    },
    {
        id: 'lucky_seven',
        title: 'Lucky Seven Streak',
        description: 'Win 7 bets in a row!',
        emoji: '🍀',
        coinReward: 300,
        checkCondition: (userState) => {
            if (userState.bettingHistory.length < 7) return false;
            let consecutiveWins = 0;
            for (let i = userState.bettingHistory.length - 1; i >= 0; i--) {
                if (userState.bettingHistory[i].won) {
                    consecutiveWins++;
                    if (consecutiveWins >= 7) return true;
                } else {
                    consecutiveWins = 0;
                }
            }
            return false;
        }
    }
];


// --- Share Utilities ---

/**
 * Generates viral share text based on user context
 * @param {Object} userState - Current user state
 * @param {Object} todaysMatchup - Today's matchup (optional)
 * @param {string} shareType - Type of share ('streak', 'pick', 'achievement', 'challenge')
 * @returns {string} Formatted share text
 */
const generateShareText = (userState, todaysMatchup = null, shareType = 'streak') => {
    const appUrl = window.location.origin; // Gets current domain
    const streakEmoji = userState.currentStreak >= 10 ? '🔥' : userState.currentStreak >= 5 ? '⚡' : '🎯';

    switch (shareType) {
        case 'streak':
            if (userState.currentStreak === 0) {
                return `Just started my streak on Streak Pick'em! 🎯\n\nWho can predict sports better than me? 💪\n\nTry it: ${appUrl}`;
            } else if (userState.currentStreak < 5) {
                return `${userState.currentStreak}-day streak and counting! ${streakEmoji}\n\nThink you can do better? Prove it 👀\n\nStreak Pick'em: ${appUrl}`;
            } else { // >=5 streak
                return `🔥 ${userState.currentStreak}-day streak! I'm on fire! ${streakEmoji}\n\nCan anyone beat this? Challenge accepted? 😏\n\nStreak Pick'em: ${appUrl}`;
            }

        case 'pick':
            if (!todaysMatchup || !userState.todaysPick) return generateShareText(userState, null, 'streak'); // Fallback if no pick made
            const pickedTeam = userState.todaysPick.selectedTeam === 'home' ? todaysMatchup.homeTeam.name : todaysMatchup.awayTeam.name;
            return `Today's pick: ${todaysMatchup.homeTeam.name} vs ${todaysMatchup.awayTeam.name} ${todaysMatchup.homeTeam.logo}\n\nI'm going with ${pickedTeam}! 🤔\n\nCurrent streak: ${userState.currentStreak} ${streakEmoji}\n\nJoin me: ${appUrl}`;

        case 'achievement':
            const currentAchievement = ACHIEVEMENTS_LIST.find(a => userState.achievements.includes(a.id)); // Find a relevant one, ideally the last unlocked
            const achievementText = currentAchievement ? `${currentAchievement.emoji} ${currentAchievement.title} UNLOCKED! ${currentAchievement.emoji}` : `I just unlocked an achievement on Streak Pick'em! 🎉`;
            return `${achievementText}\n\nI'm absolutely crushing it on Streak Pick'em! 💪\n\nWho wants to challenge the champion? 😎\n\n${appUrl}`;

        case 'challenge':
            return `🏆 I just hit ${userState.currentStreak} days on Streak Pick'em!\n\nBet you can't beat my streak 😏\n\nProve me wrong: ${appUrl}`;

        default:
            return generateShareText(userState, todaysMatchup, 'streak');
    }
};

/**
 * Handles native sharing with fallbacks
 * @param {string} text - Text to share
 * @param {string} url - URL to share (optional)
 * @param {string} title - Share title (optional)
 * @returns {Promise<boolean>} Success status
 */
const handleNativeShare = async (text, url = '', title = 'Streak Pick\'em') => {
    // Check if native sharing is available (mobile browsers)
    if (navigator.share) {
        try {
            await navigator.share({
                title: title,
                text: text,
                url: url
            });
            return true;
        } catch (error) {
            // User cancelled or error occurred
            console.log('Native share cancelled or failed:', error);
            return false;
        }
    }

    // Fallback: Copy to clipboard
    try {
        document.execCommand('copy', false, url ? `${text}\n\n${url}` : text); // Use document.execCommand for broader compatibility in iframes
        return true;
    } catch (error) {
        console.error('Clipboard access failed:', error);
        return false;
    }
};

/**
 * Platform-specific sharing functions
 */
const shareToTwitter = (text, url = '') => {
    const tweetText = encodeURIComponent(text);
    const shareUrl = url ? `&url=${encodeURIComponent(url)}` : '';
    window.open(`https://twitter.com/intent/tweet?text=${tweetText}${shareUrl}`, '_blank');
};

const shareToInstagram = (text) => {
    // Instagram doesn't have direct URL sharing for posts, but we can copy text for stories/paste
    document.execCommand('copy', false, text);
    // Could attempt to open Instagram app if on mobile
    if (/Instagram|iPhone|iPad|Android/i.test(navigator.userAgent)) {
        window.open('instagram://story-camera', '_blank'); // Tries to open story camera
    }
};

const shareToGeneric = async (text, url = '') => {
    const fullText = url ? `${text}\n\n${url}` : text;
    try {
        document.execCommand('copy', false, fullText);
        return true;
    } catch (error) {
        console.error('Failed to copy to clipboard for generic share:', error);
        return false;
    }
};

// --- Share Components ---

/**
 * ShareButton - Main share trigger button
 * @param {Object} props
 * @param {Object} props.userState - Current user state
 * @param {Object} props.todaysMatchup - Today's matchup
 * @param {string} props.shareType - Type of share
 * @param {function} props.onShare - Callback after sharing
 * @param {string} props.className - Custom styling
 * @param {React.ReactNode} props.children - Button content
 */
const ShareButton = ({ userState, todaysMatchup, shareType = 'streak', onShare, className = '', children }) => {
    const [sharing, setSharing] = useState(false);

    const handleShare = async () => {
        setSharing(true);

        try {
            const shareText = generateShareText(userState, todaysMatchup, shareType);
            const success = await handleNativeShare(shareText, window.location.origin);

            if (success) {
                onShare && onShare(shareType, 'native');
            }
        } catch (error) {
            console.error('Share failed:', error);
        } finally {
            setSharing(false);
        }
    };

    return (
        <button
            onClick={handleShare}
            disabled={sharing}
            className={`${className} ${sharing ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label="Share your streak"
        >
            {sharing ? '📤 Sharing...' : children}
        </button>
    );
};

/**
 * ShareModal - Advanced sharing options
 * @param {Object} props
 * @param {boolean} props.isOpen - Modal visibility
 * @param {function} props.onClose - Close modal callback
 * @param {Object} props.userState - Current user state
 * @param {Object} props.todaysMatchup - Today's matchup
 * @param {function} props.onShare - Share callback
 * @param {function} props.addNotification - Function to add a notification
 */
const ShareModal = ({ isOpen, onClose, userState, todaysMatchup, onShare, addNotification }) => {
    if (!isOpen) return null;

    const [shareType, setShareType] = useState('streak');
    const [copySuccess, setCopySuccess] = useState(false);

    const shareText = generateShareText(userState, todaysMatchup, shareType);

    const handlePlatformShare = async (platform) => {
        const url = window.location.origin;
        let success = false;

        switch (platform) {
            case 'twitter':
                shareToTwitter(shareText, url);
                success = true;
                break;
            case 'instagram':
                shareToInstagram(shareText);
                addNotification({type: 'info', message: 'Text copied! Paste into Instagram.'});
                success = true;
                break;
            case 'copy':
                success = await shareToGeneric(shareText, url);
                if (success) {
                    setCopySuccess(true);
                    addNotification({type: 'success', message: 'Text copied to clipboard!'});
                    setTimeout(() => setCopySuccess(false), 2000);
                } else {
                    addNotification({type: 'error', message: 'Failed to copy text.'});
                }
                break;
            case 'native':
                success = await handleNativeShare(shareText, url);
                break;
            default:
                success = false;
        }

        if (success) {
            onShare && onShare(shareType, platform);
        }
        if (platform !== 'instagram' && platform !== 'copy') {
             onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
            <div className="bg-bg-secondary rounded-2xl p-6 max-w-md w-full shadow-2xl border-2 border-bg-tertiary relative animate-fadeInUp">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-text-primary">Share Your Streak! 🔥</h3>
                    <button
                        onClick={onClose}
                        className="text-text-secondary hover:text-text-primary text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-bg-tertiary transition-colors"
                        aria-label="Close share modal"
                    >
                        ×
                    </button>
                </div>

                {/* Share Type Selector */}
                <div className="mb-4">
                    <label htmlFor="share-type" className="block text-text-primary text-sm font-medium mb-2">
                        What to share:
                    </label>
                    <select
                        id="share-type"
                        value={shareType}
                        onChange={(e) => setShareType(e.target.value)}
                        className="w-full p-3 bg-bg-tertiary text-text-primary rounded-xl border-2 border-bg-tertiary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    >
                        <option value="streak">My Current Streak</option>
                        <option value="pick">Today's Pick</option>
                        {userState.currentStreak >= 5 && <option value="achievement">Achievement Unlocked!</option>}
                        <option value="challenge">Challenge Friends</option>
                    </select>
                </div>

                {/* Preview Text */}
                <div className="mb-6 p-4 bg-bg-tertiary rounded-xl border-2 border-bg-tertiary">
                    <p className="text-text-secondary text-sm font-medium mb-2">Preview:</p>
                    <p className="text-text-primary text-sm whitespace-pre-line break-words leading-relaxed">
                        {shareText}
                    </p>
                </div>

                {/* Platform Buttons */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <button
                        onClick={() => handlePlatformShare('twitter')}
                        className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg border-2 border-blue-600"
                        aria-label="Share to Twitter"
                    >
                        🐦 Twitter
                    </button>
                    <button
                        onClick={() => handlePlatformShare('instagram')}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg border-2 border-purple-600"
                        aria-label="Share to Instagram"
                    >
                        📸 Instagram
                    </button>
                    <button
                        onClick={() => handlePlatformShare('copy')}
                        className={`${
                            copySuccess
                                ? 'bg-green-600 border-green-700'
                                : 'bg-gray-600 border-gray-700'
                        } hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg border-2`}
                        aria-label="Copy text to clipboard"
                    >
                        {copySuccess ? '✅ Copied!' : '📋 Copy Text'}
                    </button>
                    <button
                        onClick={() => handlePlatformShare('native')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg border-2 border-indigo-700"
                        aria-label="Share via more apps"
                    >
                        📤 More Apps
                    </button>
                </div>

                {/* Footer Note */}
                <p className="text-center text-text-secondary text-xs">
                    Help grow Streak Pick'em! 🚀
                </p>
            </div>
        </div>
    );
};

/**
 * RankBadge Component
 * @param {Object} props
 * @param {number | null} props.rank - The user's rank.
 * @param {number} props.streak - The user's current streak (for pulsing).
 * @param {string} [props.className] - Additional CSS classes.
 */
const RankBadge = ({ rank, streak, className }) => {
    if (rank === null || rank === 0) return null; // Don't show badge if rank is unknown or 0

    let badgeClass = '';
    if (rank <= 10) {
        badgeClass = 'top-10';
    } else if (rank <= 50) {
        badgeClass = 'top-50';
    } else if (rank <= 100) {
        badgeClass = 'top-100';
    } else {
        badgeClass = 'standard'; // Default for ranks > 100
    }

    return (
        <div className={`rank-badge ${badgeClass} ${className}`}>
            Rank: {rank}
        </div>
    );
};

/**
 * AnimatedStreakDisplay Component
 * @param {Object} props
 * @param {number} props.currentStreak - The current streak value.
 * @param {number} props.bestStreak - The best streak value.
 * @param {boolean} props.isIncreasing - True if the streak is currently increasing (for animation).
 */
const AnimatedStreakDisplay = ({ currentStreak, bestStreak, isIncreasing }) => {
    const [displayStreak, setDisplayStreak] = useState(currentStreak);
    const prevStreakRef = useRef(currentStreak);

    useEffect(() => {
        if (isIncreasing) {
            // Animate number counting up
            let start = prevStreakRef.current; // Start from previous streak
            let end = currentStreak;

            // Only animate if the current streak is actually higher than previous
            if (end > start) {
                let current = start;
                const timer = setInterval(() => {
                    current += 1;
                    setDisplayStreak(current);
                    if (current >= end) {
                        clearInterval(timer);
                    }
                }, 100); // Adjust interval for speed of counting
                return () => clearInterval(timer);
            }
        }
        // If not increasing or streak decreased, just set the value
        setDisplayStreak(currentStreak);
        prevStreakRef.current = currentStreak; // Update ref for next render
    }, [currentStreak, isIncreasing]);

    useEffect(() => {
        // Update prevStreakRef when currentStreak changes,
        // but not *during* the animation triggered by isIncreasing.
        // This ensures the animation starts from the correct previous value.
        if (!isIncreasing) {
            prevStreakRef.current = currentStreak;
        }
    }, [currentStreak, isIncreasing]);

    return (
        <div className="streak-display-container">
            <div className={`streak-number ${isIncreasing ? 'celebrating' : ''}`}>
                {displayStreak}
                <span className="streak-flame">🔥</span>
            </div>
            <p className="streak-label">Current Streak</p>
            <p className="best-streak">Best: {bestStreak}</p>
        </div>
    );
};

/**
 * FIXED EnhancedTeamCard Component - Replace your existing one
 */
const EnhancedTeamCard = ({ team, isSelected, isPicked, onClick, disabled }) => {
    const [primaryColor, secondaryColor] = team.colors;

    // Convert hex to RGB for CSS variables
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? 
            `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : 
            '128, 128, 128'; // fallback gray
    };

    const primaryRgb = hexToRgb(primaryColor);
    const secondaryRgb = hexToRgb(secondaryColor);

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`team-card ${isSelected ? 'selected' : ''} ${isPicked ? 'picked' : ''} ${disabled ? 'disabled' : ''}`}
            style={{
                // Set both hex and RGB variables
                '--team-primary': `#${primaryColor}`,
                '--team-secondary': `#${secondaryColor}`,
                '--team-primary-rgb': primaryRgb,
                '--team-secondary-rgb': secondaryRgb,
            }}
        >
            <div className="text-5xl mb-2 team-logo">
                {team.logo}
            </div>
            <div className="font-bold text-lg text-text-primary mb-1 team-abbr">
                {team.abbr}
            </div>
            <div className="text-sm text-text-secondary team-name-full">
                {team.name}
            </div>

            {/* Enhanced Color accent bar */}
            <div
                className="color-accent"
                style={{
                    background: `linear-gradient(90deg, #${primaryColor}, #${secondaryColor})`,
                    height: '4px',
                    width: '100%',
                    position: 'absolute',
                    bottom: '0',
                    left: '0',
                    borderRadius: '0 0 var(--radius-xl) var(--radius-xl)'
                }}
            />
        </button>
    );
};

/**
 * GameResultDisplay Component - Shows final game results
 * @param {Object} props
 * @param {Object} props.result - The game result object.
 * @param {Object} props.todaysMatchup - The matchup details.
 * @param {Object} props.userPick - The user's pick for today.
 */
const GameResultDisplay = ({ result, todaysMatchup, userPick }) => {
    if (!result || !todaysMatchup) return null;
    
    const winnerTeam = result.winner === 'home' ? todaysMatchup.homeTeam : todaysMatchup.awayTeam;
    const userPickedTeam = userPick?.selectedTeam ? (userPick.selectedTeam === 'home' ? todaysMatchup.homeTeam : todaysMatchup.awayTeam) : null;
    const userWasCorrect = userPick?.selectedTeam === result.winner;
    
    return (
        <div className="mt-4 bg-bg-tertiary rounded-xl p-4 border-2 border-bg-tertiary">
            <div className="text-center mb-3">
                <h4 className="font-bold text-lg text-text-primary mb-2">🏆 Final Result</h4>
                <div className="text-2xl font-bold">
                    <span className={result.winner === 'home' ? 'text-accent-win' : 'text-text-primary'}>
                        {todaysMatchup.homeTeam.abbr} {result.homeScore}
                    </span>
                    <span className="text-text-secondary mx-2">-</span>
                    <span className={result.winner === 'away' ? 'text-accent-win' : 'text-text-primary'}>
                        {result.awayScore} {todaysMatchup.awayTeam.abbr}
                    </span>
                </div>
                <p className="text-sm text-text-secondary mt-1">
                    Winner: {winnerTeam.name}
                </p>
            </div>
            
            {userPick && (
                <div className={`text-center p-3 rounded-lg ${userWasCorrect ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    <p className={`font-semibold ${userWasCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {userWasCorrect ? '✅ You were CORRECT!' : '❌ You were wrong'}
                    </p>
                    <p className="text-sm text-text-secondary">
                        You picked: {userPickedTeam?.name || 'N/A'}
                    </p>
                </div>
            )}
        </div>
    );
};


/**
 * LeaderboardEntry component for a single row in the leaderboard.
 * @param {Object} props
 * @param {LeaderboardEntry} props.entry - The leaderboard entry data.
 * @param {boolean} props.isCurrentUser - Whether this entry belongs to the current user.
 * @param {number} props.rank - The rank number.
 * @param {'current' | 'best' | 'weekly'} props.sortBy - The current sorting criterion.
 */
const LeaderboardEntry = ({ entry, isCurrentUser, rank, sortBy }) => {
    return (
        <div className={`leaderboard-entry ${isCurrentUser ? 'current-user' : ''}`}>
            <span className="w-10 font-bold text-lg text-text-primary">{rank}.</span>
            <span className="flex-1 font-semibold text-text-primary truncate">{entry.displayName}</span>
            <div className="w-24 text-right">
                {sortBy === 'current' && <span className="text-accent-win font-bold">{entry.currentStreak} 🔥</span>}
                {sortBy === 'best' && <span className="text-purple-400 font-bold">{entry.bestStreak} 🏆</span>}
                {sortBy === 'weekly' && <span className="text-blue-400 font-bold">{entry.weeklyWins} ✅</span>}
                <span className="text-sm text-text-secondary ml-2">({entry.accuracy}%)</span>
            </div>
        </div>
    );
};


/**
 * LeaderboardModal Component
 * @param {Object} props
 * @param {boolean} props.isOpen - Modal visibility.
 * @param {function} props.onClose - Close modal callback.
 * @param {UserState} props.userState - Current user's state.
 * @param {LeaderboardData} props.leaderboardData - Global leaderboard data.
 * @param {function} props.onRefreshLeaderboard - Callback to refresh leaderboard.
 * @param {string} props.userId - The current user's ID for comparison.
 */
const LeaderboardModal = ({ isOpen, onClose, userState, leaderboardData, onRefreshLeaderboard, userId }) => {
    if (!isOpen) return null;

    const [activeTab, setActiveTab] = useState('current'); // 'current', 'best', 'weekly'
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoadingRefresh, setIsLoadingRefresh] = useState(false);

    // Filter and sort users based on active tab and search term
    const sortedUsers = useMemo(() => {
        let users = [...leaderboardData.users];

        // Filter by search term
        if (searchTerm) {
            users = users.filter(user =>
                user.displayName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Sort based on active tab
        users.sort((a, b) => {
            if (activeTab === 'current') {
                if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
                return b.bestStreak - a.bestStreak; // Secondary sort
            } else if (activeTab === 'best') {
                if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
                return b.currentStreak - a.currentStreak; // Secondary sort
            } else { // 'weekly'
                if (b.weeklyWins !== a.weeklyWins) return b.weeklyWins - a.weeklyWins;
                return b.accuracy - a.accuracy; // Secondary sort
            }
        });
        return users;
    }, [leaderboardData.users, activeTab, searchTerm]);

    const handleRefresh = async () => {
        setIsLoadingRefresh(true);
        await onRefreshLeaderboard(); // Call the passed refresh function
        setIsLoadingRefresh(false);
    };

    const hashedCurrentUserId = simpleHash(userId).toString();

    return (
        <div className="leaderboard-modal animate-fadeInUp">
            <div className="leaderboard-content bg-bg-secondary text-text-primary">
                {/* Header */}
                <div className="p-4 border-b-2 border-bg-tertiary flex justify-between items-center">
                    <h3 className="text-2xl font-bold">Leaderboard</h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            className="p-2 rounded-full hover:bg-bg-tertiary transition-colors"
                            disabled={isLoadingRefresh}
                            aria-label="Refresh leaderboard"
                        >
                            {isLoadingRefresh ? (
                                <svg className="animate-spin h-5 w-5 text-text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : '🔄'}
                        </button>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            aria-label="Close leaderboard modal"
                        >
                            &times;
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="leaderboard-tabs text-text-secondary font-semibold">
                    <button
                        className={`leaderboard-tab ${activeTab === 'current' ? 'active bg-accent-info text-white rounded-tl-xl' : 'hover:bg-bg-tertiary'}`}
                        onClick={() => setActiveTab('current')}
                    >
                        Current Streak
                    </button>
                    <button
                        className={`leaderboard-tab ${activeTab === 'best' ? 'active bg-accent-info text-white' : 'hover:bg-bg-tertiary'}`}
                        onClick={() => setActiveTab('best')}
                    >
                        Best Streak
                    </button>
                    <button
                        className={`leaderboard-tab ${activeTab === 'weekly' ? 'active bg-accent-info text-white rounded-tr-xl' : 'hover:bg-bg-tertiary'}`}
                        onClick={() => setActiveTab('weekly')}
                    >
                        Weekly Wins
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b-2 border-bg-tertiary">
                    <input
                        type="text"
                        placeholder="Search by name..."
                        className="w-full p-2 rounded-lg bg-bg-tertiary text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-info"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Leaderboard List */}
                <div className="py-2">
                    {sortedUsers.length > 0 ? (
                        sortedUsers.map((entry, index) => (
                            <LeaderboardEntry
                                key={entry.id}
                                entry={entry}
                                isCurrentUser={entry.id === hashedCurrentUserId} // Compare with hashed user ID from prop
                                rank={index + 1}
                                sortBy={activeTab}
                            />
                        ))
                    ) : (
                        <p className="text-center text-text-secondary p-4">No users found.</p>
                    )}
                </div>

                {/* Current User's Rank (if not in top 50 displayed) */}
                {leaderboardData.userRank && (leaderboardData.userRank > sortedUsers.length || searchTerm) && (
                    <div className="p-4 border-t-2 border-bg-tertiary">
                        <p className="text-center text-text-secondary">
                            Your Rank: <span className="font-bold text-accent-info">{leaderboardData.userRank}</span>
                            {activeTab === 'current' && ` (Streak: ${userState.currentStreak})`}
                            {activeTab === 'best' && ` (Best: ${userState.bestStreak})`}
                            {activeTab === 'weekly' && ` (Weekly Wins: ${userState.weeklyStats.correct})`}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

/**
 * LeaderboardPreview Component
 * @param {Object} props
 * @param {LeaderboardData} props.leaderboardData - Global leaderboard data.
 * @param {UserState} props.userState - Current user's state.
 * @param {function} props.onOpenFull - Callback to open the full leaderboard modal.
 * @param {number} props.userCount - Total count of users on the leaderboard.
 */
const LeaderboardPreview = ({ leaderboardData, userState, onOpenFull, userCount }) => {
    const top3 = leaderboardData.users.slice(0, 3);
    const userRank = leaderboardData.userRank;

    return (
        <div className="bg-bg-secondary rounded-xl p-4 shadow-lg border border-bg-tertiary animate-fadeInUp">
            <div className="flex justify-between items-center mb-3">
                <h4 className="text-lg font-bold text-text-primary">Leaderboard Preview</h4>
                <button
                    onClick={onOpenFull}
                    className="text-accent-info hover:text-blue-500 font-semibold text-sm transition-colors"
                >
                    View Full 🏆
                </button>
            </div>

            {/* Leaderboard Status - Real User Indicator */}
            <LeaderboardStatus userCount={userCount} />

            {top3.length > 0 ? (
                <div className="space-y-2 mb-3">
                    {top3.map((entry, index) => (
                        <div key={entry.id} className="flex justify-between items-center text-sm">
                            <span className="font-semibold text-text-primary">{index + 1}. {entry.displayName}</span>
                            <span className="text-accent-win font-bold">{entry.currentStreak} 🔥</span>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-center text-text-secondary text-sm mb-3">Leaderboard is empty. Be the first!</p>
            )}

            {userRank && (
                <div className="text-center text-text-secondary text-sm pt-2 border-t border-bg-tertiary">
                    Your Rank: <span className="font-bold text-accent-info">{userRank}</span> (Streak: {userState.currentStreak})
                </div>
            )}
        </div>
    );
};

/**
 * LeaderboardStatus - Component to show count of real users competing.
 * @param {Object} props
 * @param {number} props.userCount - Total count of users on the leaderboard.
 */
const LeaderboardStatus = ({ userCount }) => {
    if (userCount === 0) {
        return (
            <div className="text-center text-sm text-text-secondary mb-2">
                🎯 Be the first to start the competition!
            </div>
        );
    }

    return (
        <div className="text-center text-sm text-accent-info mb-2">
            🌍 {userCount} real {userCount === 1 ? 'player' : 'players'} competing globally!
        </div>
    );
};

// --- Error Boundary Component (as conceptual placeholder per prompt) ---
// In a real Next.js app, you'd use a file-based error.js or client-side error boundaries.
// This is a simplified version to match the prompt's structural request.
class ErrorBoundaryComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.props.onError(error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback;
        }
        return this.props.children;
    }
}

const ErrorDisplay = ({ message }) => (
    <div className="min-h-screen bg-red-800 text-white flex flex-col items-center justify-center p-4">
        <h2 className="text-3xl font-bold mb-4">An Error Occurred!</h2>
        <p className="text-lg text-center mb-6">{message || "Something went wrong. Please try refreshing."}</p>
        <button
            onClick={() => window.location.reload()}
            className="bg-white text-red-800 font-bold py-3 px-6 rounded-lg hover:bg-gray-200 transition-colors"
        >
            Reload Page
        </button>
    </div>
);


// ========== GAMETIMEDISPLAY WITH ENHANCED DEBUGGING ==========
/**
 * Enhanced GameTimeDisplay with detailed mobile debugging
 */
const EnhancedGameTimeDisplay = ({ startTime, setTimeLeft, matchupId }) => {
    const [gameTime, setGameTime] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!startTime) {
            setTimeLeft('No start time');
            setError('No start time provided');
            return;
        }

        // Ensured robust date parsing
        let parsedTime = null;

        try {
            parsedTime = new Date(startTime);
            if (isNaN(parsedTime.getTime())) {
                throw new Error('Invalid date');
            }
            
            setGameTime(parsedTime);
            setError(null);
            

        } catch (parseError) {
            console.error('Timer: Date parsing failed:', parseError);
            const fallbackTime = new Date(Date.now() + 60 * 60 * 1000);
            setGameTime(fallbackTime);
            setError(`Parse failed: ${parseError.message}`);
        }
    }, [startTime, matchupId]);

    // Enhanced timer logic with debugging
    useEffect(() => {
        if (!gameTime) return;

        let isActive = true;

        const updateTimer = () => {
            if (!isActive) return;

            const now = new Date();
            const diff = gameTime - now;

            if (diff <= 0) {
                setTimeLeft('Game Started');
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            const timeString = `${hours}h ${minutes}m ${seconds}s`;
            setTimeLeft(timeString);
            
        };

        updateTimer(); // Initial call
        const intervalId = setInterval(updateTimer, 1000);

        return () => {
            isActive = false;
            clearInterval(intervalId);
        };
    }, [gameTime, setTimeLeft]);

    if (!gameTime) {
        return (
            <div className="text-yellow-500">
                ⏰ Loading game time...
                {error && <div className="text-xs text-red-500">Error: {error}</div>}
            </div>
        );
    }

    return (
        <div className="game-time-display">
            <p className="timer-text text-sm text-text-secondary">
                Game Time: {gameTime.toLocaleString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric', 
                    hour: 'numeric', 
                    minute: '2-digit', 
                    timeZoneName: 'short' 
                })}
            </p>
            {error && (
                <p className="text-xs text-yellow-500 mt-1">⚠️ {error}</p>
            )}
        </div>
    );
};


// --- NEW COMPONENTS ---

/**
 * Pick Confirmation Modal
 */
const PickConfirmationModal = ({ isOpen, onClose, onConfirm, selectedTeam, matchup, betAmount, userCoins }) => {
    if (!isOpen || !selectedTeam || !matchup) return null;

    const otherTeam = selectedTeam.abbr === matchup.homeTeam.abbr ? matchup.awayTeam : matchup.homeTeam;
    const triggerHaptic = useHapticFeedback();

    const handleConfirm = () => {
        triggerHaptic('pick_confirm');
        onConfirm();
    };

    const handleCancel = () => {
        triggerHaptic('light');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] backdrop-blur-sm p-4">
            <div className="bg-bg-secondary rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border-2 border-bg-tertiary animate-fadeInUp">
                <h3 className="text-xl font-bold text-center mb-4 text-text-primary">Confirm Your Pick</h3>
                
                {/* Team Card Preview */}
                <div className="text-center mb-6">
                    <div className="text-6xl mb-2">{selectedTeam.logo}</div>
                    <h4 className="text-lg font-bold text-text-primary">{selectedTeam.name}</h4>
                    <p className="text-sm text-text-secondary">vs {otherTeam.abbr}</p>
                    <p className="text-md text-text-secondary mt-2">Bet Amount: <span className="font-bold text-yellow-400">{betAmount} 🪙</span></p>
                    <p className="text-md text-text-secondary">Potential Winnings: <span className="font-bold text-green-400">{betAmount * 2} 🪙</span></p>
                </div>
                
                {/* Warning Text */}
                <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 rounded-lg p-3 mb-4">
                    <p className="text-sm text-yellow-800 dark:text-yellow-400 text-center">
                        ⚠️ This pick cannot be changed once confirmed!
                    </p>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button onClick={handleCancel} className="flex-1 py-3 px-4 bg-gray-500 hover:bg-gray-600 text-white rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-md">
                        Cancel
                    </button>
                    <button onClick={handleConfirm} className="flex-1 py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-md">
                        Confirm Pick! 🎯
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * Betting Interface Component
 */
const BettingInterface = ({ onBetChange, maxBet = 100, userCoins, currentBet }) => {
    const quickBets = [10, 25, 50, 100];
    const triggerHaptic = useHapticFeedback();

    useEffect(() => {
        // Ensure currentBet is within limits
        if (currentBet > userCoins) {
            onBetChange(Math.min(userCoins, quickBets[0])); // Set to minimum or userCoins if too low
        }
    }, [userCoins, currentBet, onBetChange]);

    const handleBetButtonClick = (amount) => {
        if (amount <= userCoins) {
            onBetChange(amount);
            triggerHaptic('light');
        }
    };

    return (
        <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-xl p-4 border border-purple-500/30 mb-6">
            <h4 className="font-bold text-center mb-3 text-text-primary">💰 Place Your Bet</h4>
            
            {/* Coin Balance */}
            <div className="text-center mb-3">
                <span className="text-lg font-bold text-yellow-400">{userCoins} 🪙</span>
            </div>
            
            {/* Quick Bet Buttons */}
            <div className="grid grid-cols-4 gap-2 mb-3">
                {quickBets.map(amount => (
                    <button
                        key={amount}
                        onClick={() => handleBetButtonClick(amount)}
                        disabled={amount > userCoins}
                        className={`py-2 px-3 rounded-lg font-semibold text-sm transition-all duration-200 transform hover:scale-105
                            ${currentBet === amount 
                                ? 'bg-purple-600 text-white' 
                                : 'bg-bg-tertiary text-text-primary hover:bg-purple-600/50'
                            }
                            ${amount > userCoins ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                    >
                        {amount} 🪙
                    </button>
                ))}
            </div>
            
            {/* Potential Winnings */}
            <div className="text-center text-sm text-text-secondary">
                Win: <span className="font-bold text-green-400">{currentBet * 2} 🪙</span> | 
                Risk: <span className="font-bold text-red-400">{currentBet} 🪙</span>
            </div>
        </div>
    );
};

/**
 * Daily Reward Modal
 */
const DailyRewardModal = ({ isOpen, onClose, rewardAmount }) => {
    if (!isOpen) return null;
    const triggerHaptic = useHapticFeedback();

    const handleCollect = () => {
        triggerHaptic('coin_collect');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] backdrop-blur-sm p-4">
            <div className="bg-bg-secondary rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border-2 border-bg-tertiary animate-fadeInUp">
                <div className="text-center">
                    <div className="text-6xl mb-4 animate-bounce">🎁</div>
                    <h3 className="text-2xl font-bold mb-2 text-text-primary">Daily Bonus!</h3>
                    <p className="text-lg mb-4 text-text-secondary">You earned <span className="font-bold text-yellow-400">{rewardAmount} 🪙</span></p>
                    <p className="text-sm text-text-secondary mb-6">Come back tomorrow for another bonus!</p>
                    <button onClick={handleCollect} className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-md">
                        Collect Reward!
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * Achievement Unlocked Modal
 */
const AchievementUnlockedModal = ({ achievement, isOpen, onClose }) => {
    if (!isOpen || !achievement) return null;
    const triggerHaptic = useHapticFeedback();

    useEffect(() => {
        if (isOpen) {
            triggerHaptic('success');
        }
    }, [isOpen, triggerHaptic]);

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] backdrop-blur-sm p-4">
            <div className="bg-bg-secondary rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border-2 border-bg-tertiary animate-fadeInUp">
                <div className="text-center">
                    <div className="text-6xl mb-4 animate-pulse">{achievement.emoji}</div>
                    <h3 className="text-xl font-bold mb-2 text-text-primary">Achievement Unlocked!</h3>
                    <h4 className="text-lg text-purple-400 mb-2">{achievement.title}</h4>
                    <p className="text-sm text-text-secondary mb-4">{achievement.description}</p>
                    <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-black font-bold py-2 px-4 rounded-lg inline-block shadow-md">
                        +{achievement.coinReward} 🪙 Bonus!
                    </div>
                    <button onClick={onClose} className="mt-6 w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all duration-200 transform hover:scale-105 shadow-md">
                        Awesome!
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * Team Card Skeleton for loading state
 */
const TeamCardSkeleton = () => (
    <div className="team-card animate-pulse bg-bg-secondary border-bg-tertiary">
        <div className="w-16 h-16 bg-bg-tertiary rounded-full mb-2 loading-shimmer"></div>
        <div className="w-12 h-4 bg-bg-tertiary rounded mb-1 loading-shimmer"></div>
        <div className="w-20 h-3 bg-bg-tertiary rounded loading-shimmer"></div>
        <div className="color-accent" style={{ background: 'linear-gradient(90deg, #505050, #808080)', height: '4px' }}></div>
    </div>
);

/**
 * Enhanced Button component with loading state
 */
const EnhancedButton = ({ children, onClick, loading, className = '', ...props }) => {
    const triggerHaptic = useHapticFeedback();
    const handleClick = (e) => {
        if (!loading) {
            triggerHaptic('light');
            onClick && onClick(e);
        }
    };

    return (
        <button
            onClick={handleClick}
            disabled={loading}
            className={`relative overflow-hidden group py-3 px-4 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-md ${className} ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            {...props}
        >
            {loading && (
                <div className="absolute inset-0 bg-white/20 flex items-center justify-center rounded-xl">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                </div>
            )}
            <span className={loading ? 'opacity-0' : 'opacity-100'}>{children}</span>
        </button>
    );
};

/**
 * Floating Share Button
 */
const FloatingShareButton = ({ onClick }) => (
    <button
        onClick={onClick}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-300 z-40 flex items-center justify-center text-2xl"
        aria-label="Quick share"
    >
        📱
    </button>
);

/**
 * Stats Card Component
 */
const StatsCard = ({ title, value, change, color }) => (
    <div className="bg-bg-secondary rounded-xl p-4 border border-bg-tertiary hover:border-opacity-80 transition-all shadow-md">
        <div className="flex justify-between items-start mb-2">
            <span className="text-sm text-text-secondary">{title}</span>
            {change !== undefined && change !== null && (
                <span className={`text-xs font-semibold ${change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-text-secondary'}`}>
                    {change > 0 ? '↗' : change < 0 ? '↘' : ''} {Math.abs(change)}{change !== 0 ? '%' : ''}
                </span>
            )}
        </div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
);

/**
 * NEW: PickHistoryModal component
 */
const PickHistoryModal = ({ isOpen, onClose, pickHistory, todaysMatchups }) => {
    if (!isOpen) return null;

    const [filter, setFilter] = useState('all'); // 'all', 'wins', 'losses', 'this_week'
    const [searchTerm, setSearchTerm] = useState('');

    const filteredHistory = useMemo(() => {
        let history = [...pickHistory].reverse(); // Show most recent first

        if (searchTerm) {
            history = history.filter(pick =>
                pick.homeTeam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                pick.awayTeam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                pick.selectedTeam.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (filter === 'wins') {
            history = history.filter(pick => pick.result === 'win');
        } else if (filter === 'losses') {
            history = history.filter(pick => pick.result === 'loss');
        } else if (filter === 'this_week') {
            const currentWeekMonday = new Date(getMondayOfCurrentWeek());
            history = history.filter(pick => {
                const pickDate = new Date(pick.date);
                return pickDate >= currentWeekMonday;
            });
        }
        return history;
    }, [pickHistory, filter, searchTerm]);

    const getTeamName = (matchupId, teamType) => {
        // This is a simplification; ideally, pickHistory should store full team names for consistency.
        // For now, we'll try to find it in today's matchups or use what's stored.
        const pickEntry = pickHistory.find(p => p.matchupId === matchupId);
        if (pickEntry) {
            return teamType === 'home' ? pickEntry.homeTeam.name : pickEntry.awayTeam.name;
        }
        return `Team ${teamType}`; // Fallback
    }

    return (
        <div className="leaderboard-modal animate-fadeInUp"> {/* Reusing leaderboard-modal styling */}
            <div className="leaderboard-content bg-bg-secondary text-text-primary">
                {/* Header */}
                <div className="p-4 border-b-2 border-bg-tertiary flex justify-between items-center">
                    <h3 className="text-2xl font-bold">📊 Pick History</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label="Close pick history modal"
                    >
                        &times;
                    </button>
                </div>

                {/* Filters */}
                <div className="leaderboard-tabs text-text-secondary font-semibold">
                    <button
                        className={`leaderboard-tab ${filter === 'all' ? 'active bg-accent-info text-white rounded-tl-xl' : 'hover:bg-bg-tertiary'}`}
                        onClick={() => setFilter('all')}
                    >
                        All
                    </button>
                    <button
                        className={`leaderboard-tab ${filter === 'wins' ? 'active bg-accent-info text-white' : 'hover:bg-bg-tertiary'}`}
                        onClick={() => setFilter('wins')}
                    >
                        Wins
                    </button>
                    <button
                        className={`leaderboard-tab ${filter === 'losses' ? 'active bg-accent-info text-white' : 'hover:bg-bg-tertiary'}`}
                        onClick={() => setFilter('losses')}
                    >
                        Losses
                    </button>
                    <button
                        className={`leaderboard-tab ${filter === 'this_week' ? 'active bg-accent-info text-white rounded-tr-xl' : 'hover:bg-bg-tertiary'}`}
                        onClick={() => setFilter('this_week')}
                    >
                        This Week
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b-2 border-bg-tertiary">
                    <input
                        type="text"
                        placeholder="Search teams..."
                        className="w-full p-2 rounded-lg bg-bg-tertiary text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-info"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* History Table */}
                <div className="p-4">
                    {filteredHistory.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm text-text-primary">
                                <thead className="border-b-2 border-bg-tertiary">
                                    <tr>
                                        <th className="py-2 px-2 text-left">Date</th>
                                        <th className="py-2 px-2 text-left">Matchup</th>
                                        <th className="py-2 px-2 text-left">Pick</th>
                                        <th className="py-2 px-2 text-right">Bet</th>
                                        <th className="py-2 px-2 text-center">Result</th>
                                        <th className="py-2 px-2 text-right">Winnings</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredHistory.map((pick) => (
                                        <tr key={pick.id} className="border-b border-bg-tertiary last:border-b-0">
                                            <td className="py-2 px-2 text-xs">{new Date(pick.date).toLocaleDateString()}</td>
                                            <td className="py-2 px-2">
                                                {pick.homeTeam.abbr} vs {pick.awayTeam.abbr}
                                            </td>
                                            <td className="py-2 px-2 font-semibold">
                                                {pick.selectedTeam === 'home' ? pick.homeTeam.abbr : pick.awayTeam.abbr}
                                            </td>
                                            <td className="py-2 px-2 text-right">{pick.betAmount} 🪙</td>
                                            <td className="py-2 px-2 text-center">
                                                {pick.result === 'win' && <span className="text-green-500">✅ Win</span>}
                                                {pick.result === 'loss' && <span className="text-red-500">❌ Loss</span>}
                                                {pick.result === null && <span className="text-gray-500">⏳ Pending</span>}
                                            </td>
                                            <td className="py-2 px-2 text-right">
                                                {pick.winnings} 🪙
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-center text-text-secondary p-4">No picks in history yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

/**
 * NEW: TutorialModal component
 */
const TutorialModal = ({ isOpen, step, onNext, onClose, totalSteps }) => {
    if (!isOpen) return null;

    const steps = [
        { title: "Welcome!", content: "Pick the winning team daily to build your streak!" },
        { title: "Choose Your Team", content: "Tap a team card to make your pick" },
        { title: "Place Your Bet", content: "Select how many coins to bet (10-100)" },
        { title: "Earn Coins", content: "Win 2x your bet amount if you're correct!" },
        { title: "Build Streaks", content: "Consecutive wins build your streak ranking" },
        { title: "Ready to Play!", content: "Make your first pick and start winning!" }
    ];

    const currentStepContent = steps[step];

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] backdrop-blur-sm p-4">
            <div className="bg-bg-secondary rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border-2 border-bg-tertiary animate-fadeInUp">
                <div className="text-center">
                    <h3 className="text-2xl font-bold mb-3 text-text-primary">{currentStepContent.title}</h3>
                    <p className="text-md text-text-secondary mb-6">{currentStepContent.content}</p>

                    <div className="text-text-secondary mb-4">
                        Step {step + 1} of {totalSteps}
                    </div>

                    <div className="flex gap-3">
                        {step < totalSteps - 1 ? (
                            <button onClick={onNext} className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-md">
                                Next
                            </button>
                        ) : (
                            <button onClick={onClose} className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-md">
                                Let's Play!
                            </button>
                        )}
                        <button onClick={onClose} className="py-3 px-4 bg-gray-500 hover:bg-gray-600 text-white rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-md">
                            {step < totalSteps - 1 ? 'Skip' : 'Close'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * NEW: GameSelector Component
 */
const GameSelector = ({ games, selectedIndex, onSelect }) => (
    <div className="flex justify-center gap-2 mb-4 overflow-x-auto py-2 px-2 scrollbar-hide">
        {games.map((game, index) => (
            <button        
                key={game.id}        
                onClick={() => onSelect(index)}        
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 transform hover:scale-105 shadow-md
                    ${selectedIndex === index             
                        ? 'bg-blue-600 text-white border-2 border-blue-700'             
                        : 'bg-bg-tertiary text-text-primary border-2 border-bg-tertiary hover:bg-bg-quaternary'        
                    }`}      
            >        
                Game {index + 1} - {new Date(game.startTime).toLocaleTimeString('en-US', {           
                    hour: 'numeric',           
                    minute: '2-digit'         
                })}      
            </button>    
        ))}  
    </div>
);


// ========== APP COMPONENT WITH FIXES ==========
/**
 * Modified App component with comprehensive debugging
 */
const App = ({ user }) => {
    const userId = user?.id || 'anonymous';
    const [userState, setUserState] = useLocalStorage('streakPickemUser', initialUserState, userId);
    
    // Share analytics state
    const [shareStats, setShareStats] = useLocalStorage('shareStats', {
        totalShares: 0,
        sharesByType: {},
        sharesByPlatform: {},
        lastShared: null
    }, userId); 

    // ✅ ADD: Missing game result state (like in working single-game version)
    const [gameResult, setGameResult] = useState(null);
    const [resultLoading, setResultLoading] = useState(false);
    
    // MODIFIED: gameResults to be an object keyed by game ID
    const [gameResults, setGameResults] = useState({}); // Object keyed by game ID
    const [cachedGameResults, setCachedGameResults] = useLocalStorage('gameResults', {}, userId);

    // Leaderboard data - NOW USING REAL Firebase LEADERBOARD HOOK
    const { leaderboardData, updateLeaderboard, refreshLeaderboard } = useFirebaseLeaderboard(userState, userId);


    const { playSound } = useSound(userState.soundEnabled);
    const { addNotification, notifications, dismissNotification } = useNotifications();
    const triggerHaptic = useHapticFeedback(); // Initialize haptic feedback hook

    // Use local date for comparison
    const getUSEasternDate = () => {
    const usEasternTime = new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
    const usDate = new Date(usEasternTime);
    const year = usDate.getFullYear();
    const month = String(usDate.getMonth() + 1).padStart(2, '0');
    const day = String(usDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const today = getUSEasternDate();
    const currentWeekMonday = getMondayOfCurrentWeek(); // This remains UTC based, which is fine for week start

    // FEATURE 3: Multi-Game System - State changes
    const [todaysMatchups, setTodaysMatchups] = useState([]); // NEW: Array of matchups
    const [selectedGameIndex, setSelectedGameIndex] = useState(0); // NEW: Index of currently viewed game

    const [matchupLoading, setMatchupLoading] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false); // NEW: To signal initial data load complete
    const [showShareModal, setShowShareModal] = useState(false); // State for share modal visibility
    const [showLeaderboard, setShowLeaderboard] = useState(false); // State for leaderboard modal visibility
    const [isStreakIncreasing, setIsStreakIncreasing] = useState(false); // For streak animation
    const [timeLeft, setTimeLeft] = useState('');
    const [gameStarted, setGameStarted] = useState(false); // New state for game started

    // Pick Confirmation Modal states
    const [showPickConfirmationModal, setShowPickConfirmationModal] = useState(false);
    const [teamToConfirm, setTeamToConfirm] = useState(null);
    const [betAmount, setBetAmount] = useState(25); // Default bet amount

    // Daily Reward Modal states
    const [showDailyRewardModal, setShowDailyRewardModal] = useState(false);
    const DAILY_BONUS_AMOUNT = 50;

    // Achievement Modal states
    const [showAchievementModal, setShowAchievementModal] = useState(false);
    const [unlockedAchievement, setUnlockedAchievement] = useState(null);

    // FEATURE 1: Pick History Page - State
    const [showPickHistory, setShowPickHistory] = useState(false);

    // FEATURE 2: Onboarding Tutorial - State
    const [showTutorial, setShowTutorial] = useState(false);
    const [tutorialStep, setTutorialStep] = useState(0);
    const TUTORIAL_TOTAL_STEPS = 6;


    // Initialize userState displayName and weeklyStats on first load or user change
    useEffect(() => {
        setUserState(prev => {
            const updatedState = { ...prev };
            let needsUpdate = false;

            // Update display name from Whop account
            const newDisplayName = getDisplayName(user);
            if (prev.displayName !== newDisplayName) {
                updatedState.displayName = newDisplayName;
                needsUpdate = true;
            }

            // Initialize weekly stats if needed
            if (!prev.weeklyStats || prev.weeklyStats.weekStart !== currentWeekMonday) {
                updatedState.weeklyStats = {
                    picks: 0,
                    correct: 0,
                    weekStart: currentWeekMonday
                };
                needsUpdate = true;
            }

            // Initialize new coin/betting fields if they don't exist (for old users)
            if (typeof updatedState.coins === 'undefined') { updatedState.coins = initialUserState.coins; needsUpdate = true; }
            if (typeof updatedState.totalCoinsEarned === 'undefined') { updatedState.totalCoinsEarned = initialUserState.totalCoinsEarned; needsUpdate = true; }
            if (typeof updatedState.totalCoinsSpent === 'undefined') { updatedState.totalCoinsSpent = initialUserState.totalCoinsSpent; needsUpdate = true; }
            if (typeof updatedState.lastDailyBonus === 'undefined') { updatedState.lastDailyBonus = initialUserState.lastDailyBonus; needsUpdate = true; }
            if (typeof updatedState.bettingHistory === 'undefined') { updatedState.bettingHistory = initialUserState.bettingHistory; needsUpdate = true; }
            if (typeof updatedState.achievements === 'undefined') { updatedState.achievements = initialUserState.achievements; needsUpdate = true; }
            if (typeof updatedState.pickHistoryData === 'undefined') { updatedState.pickHistoryData = initialUserState.pickHistoryData; needsUpdate = true; } // NEW: For pick history

            return needsUpdate ? updatedState : prev;
        });
    }, [user, currentWeekMonday, setUserState]);

    // FEATURE 3: Multi-Game System - Load today's matchups
    useEffect(() => {
        const loadTodaysGames = async () => {
            setMatchupLoading(true);
            try {
                // Changed from getTodaysMLBGame to getTodaysMLBGames
                const games = await getTodaysMLBGames(); 
                setTodaysMatchups(games); // Changed from setTodaysMatchup
                // Reset selected game index if no games or index out of bounds
                if (games.length === 0 || selectedGameIndex >= games.length) {
                    setSelectedGameIndex(0);
                }
            } catch (error) {
                console.error('Games loading failed:', error);
                setTodaysMatchups([]); // Changed from setTodaysMatchup(null)
            }
            setMatchupLoading(false);
        };
        loadTodaysGames();
    }, []); // Removed userTimezone from dependencies as it's handled internally by getTodaysMLBGames

    // Derive the currently selected matchup
    const todaysMatchup = todaysMatchups[selectedGameIndex];

    // Determine if user has picked today (only if todaysMatchup is available)
    const hasPickedToday = todaysMatchup && userState.todaysPick?.matchupId === todaysMatchup.id && userState.todaysPick?.date === today;

    // Game timer state
    useEffect(() => {
    if (!todaysMatchup?.startTime) {
        setTimeLeft('No game time');
        setGameStarted(false); // ✅ Reset when no game
        return;
    }
    
    // FORCE consistent parsing
    let gameTime;
    try {
        gameTime = new Date(todaysMatchup.startTime);
        if (isNaN(gameTime.getTime())) {
            throw new Error('Invalid date');
        }
    } catch (error) {
        console.error('Timer: Date parsing failed:', error);
        setTimeLeft('Invalid game time');
        setGameStarted(false); // ✅ Reset on error
        return;
    }
    
    const updateTimer = () => {
        const now = new Date();
        const diff = gameTime - now;
        
        if (diff <= 0) {
            setGameStarted(true);
            setTimeLeft('Game Started');
            return;
        } else {
            setGameStarted(false); // ✅ Reset if game hasn't started yet
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        if (hours > 0) {
            setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        } else {
            setTimeLeft(`${minutes}m ${seconds}s`);
        }
    };
    
    updateTimer(); // Initial call
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
}, [todaysMatchup?.startTime]);


    /**
     * Handles opening the pick confirmation modal.
     * @param {'home' | 'away'} teamChoice - 'home' or 'away' team.
     */
    const handlePickInitiate = useCallback((teamChoice) => {
        if (!todaysMatchup) {
            addNotification({ type: 'error', message: 'Matchup not loaded yet. Please wait.' });
            triggerHaptic('error');
            return;
        }
        if (hasPickedToday || gameStarted) {
            addNotification({ type: 'warning', message: 'You have already picked for today or the game has started!' });
            triggerHaptic('medium');
            return;
        }
        if (userState.coins < betAmount) {
            addNotification({ type: 'error', message: `Not enough coins! You have ${userState.coins} 🪙 but need ${betAmount} 🪙.` });
            triggerHaptic('error');
            return;
        }

        setTeamToConfirm(teamChoice === 'home' ? todaysMatchup.homeTeam : todaysMatchup.awayTeam);
        setShowPickConfirmationModal(true);
        triggerHaptic('light');

    }, [todaysMatchup, hasPickedToday, gameStarted, userState.coins, betAmount, addNotification, triggerHaptic]);

    /**
     * Confirms and processes the pick after modal confirmation.
     * Modified to save detailed pick history.
     */
    const confirmPick = useCallback(() => {
        setShowPickConfirmationModal(false);
        if (!teamToConfirm || !todaysMatchup) return; // Ensure matchup is available

        const teamChoice = teamToConfirm.abbr === todaysMatchup.homeTeam.abbr ? 'home' : 'away';

        setUserState(prev => ({
            ...prev,
            todaysPick: {
                matchupId: todaysMatchup.id,
                selectedTeam: teamChoice,
                timestamp: new Date().toISOString(),
                date: today,
                bet: betAmount // Store the bet amount
            },
            lastPickDate: today,
            totalPicks: prev.totalPicks + 1,
            weeklyStats: {
                ...prev.weeklyStats,
                picks: prev.weeklyStats.picks + 1
            },
            coins: prev.coins - betAmount, // Deduct coins on pick
            totalCoinsSpent: prev.totalCoinsSpent + betAmount,
            bettingHistory: [...prev.bettingHistory, {
                matchupId: todaysMatchup.id,
                pickDate: today,
                selectedTeam: teamChoice,
                betAmount: betAmount,
                won: null // Will be updated after result
            }],
            // FEATURE 1: Pick History Page - Add detailed history
            pickHistoryData: [...prev.pickHistoryData, {
                id: Date.now(), // Unique ID for this pick entry
                date: today,
                matchupId: todaysMatchup.id,
                homeTeam: { name: todaysMatchup.homeTeam.name, abbr: todaysMatchup.homeTeam.abbr },
                awayTeam: { name: todaysMatchup.awayTeam.name, abbr: todaysMatchup.awayTeam.abbr },
                selectedTeam: teamChoice, // 'home' or 'away'
                betAmount: betAmount,
                result: null, // Will be updated later: 'win', 'loss', 'tie'
                winnings: 0 // Will be updated later
            }]
        }));

        addNotification({
            type: 'info',
            message: `You picked: ${teamToConfirm.name} for ${betAmount} 🪙. Good luck!`
        });
        playSound('pick_select');

    }, [teamToConfirm, todaysMatchup, today, betAmount, setUserState, addNotification, playSound]);

    // ✅ FIXED: fetchAndDisplayResult with proper state updates
    const fetchAndDisplayResult = useCallback(async (targetGameId = null) => {
        // Find the target game from the list of today's matchups
        const targetGame = targetGameId ? todaysMatchups.find(g => g.id === targetGameId) : todaysMatchup;
        if (!targetGame || resultLoading) return;
        
        setResultLoading(true);
        try {
            const result = await fetchMLBGameResult(targetGame.id, targetGame.sport, targetGame.startTime);
            if (result) {
                // ✅ Store result for this specific game
                setGameResults(prev => ({ ...prev, [targetGame.id]: result }));
                setCachedGameResults(prev => ({ ...prev, [targetGame.id]: result }));
                
                // ✅ Update current game result if this is the selected game
                if (targetGame.id === todaysMatchup?.id) {
                    setGameResult(result);
                }
                
                // ✅ Update user state ONLY if this is the game they picked and it's today
                if (userState.todaysPick?.matchupId === targetGame.id && userState.todaysPick.date === today && result.completedAt) {
                    const userPickedTeam = userState.todaysPick.selectedTeam; // 'home' or 'away'
                    const actualWinner = result.winner; // 'home', 'away', or 'tie'
                    const bet = userState.todaysPick.bet || 0;
                    let isCorrect = userPickedTeam === actualWinner;

                    // Treat ties as correct to keep streak going
                    if (actualWinner === 'tie') {
                        isCorrect = true;
                    }

                    setIsStreakIncreasing(isCorrect);

                    setUserState(prev => {
                        // ✅ FIX: Properly calculate streak values
                        const newCurrentStreak = isCorrect ? prev.currentStreak + 1 : 0;
                        const newBestStreak = Math.max(prev.bestStreak, newCurrentStreak);
                        const winnings = isCorrect ? bet * 2 : 0;
                        const updatedCoins = prev.coins + winnings;
                        const updatedTotalCoinsEarned = prev.totalCoinsEarned + winnings;

                        // Update betting history for this game
                        const updatedBettingHistory = prev.bettingHistory.map(entry =>
                            entry.matchupId === targetGame.id && entry.pickDate === today
                                ? { ...entry, won: isCorrect, winnings: winnings }
                                : entry
                        );

                        // Update pick history data
                        const updatedPickHistoryData = prev.pickHistoryData.map(entry =>
                            entry.matchupId === targetGame.id && entry.date === today
                                ? { ...entry, result: isCorrect ? 'win' : 'loss', winnings: winnings }
                                : entry
                        );

                        return {
                            ...prev,
                            correctPicks: prev.correctPicks + (isCorrect ? 1 : 0),
                            currentStreak: newCurrentStreak,  // ✅ Now properly defined
                            bestStreak: newBestStreak,        // ✅ Now properly defined
                            weeklyStats: {
                                ...prev.weeklyStats,
                                correct: prev.weeklyStats.correct + (isCorrect ? 1 : 0)
                            },
                            coins: updatedCoins,
                            totalCoinsEarned: updatedTotalCoinsEarned,
                            bettingHistory: updatedBettingHistory,
                            pickHistoryData: updatedPickHistoryData
                        };
                    });

                    const resultMessage = isCorrect ?
                        `🎉 Correct! ${result.winner === 'home' ? targetGame.homeTeam.name : targetGame.awayTeam.name} won ${result.homeScore}-${result.awayScore}. You won ${bet * 2} 🪙!` :
                        `😞 Wrong! You picked ${userState.todaysPick.selectedTeam === 'home' ? targetGame.homeTeam.abbr : targetGame.awayTeam.abbr}, but ${result.winner === 'home' ? targetGame.homeTeam.name : targetGame.awayTeam.name} won ${result.homeScore}-${result.awayScore}. You lost ${bet} 🪙.`;

                    addNotification({
                        type: isCorrect ? 'success' : 'error',
                        message: resultMessage
                    });
                    playSound(isCorrect ? 'pick_correct' : 'pick_wrong');
                    triggerHaptic(isCorrect ? 'success' : 'error');

                    setTimeout(() => setIsStreakIncreasing(false), 1500);
                }
            }
        } catch (error) {
            console.error(`Error fetching game result for game ${targetGameId}:`, error);
            addNotification({ type: 'error', message: 'Failed to fetch game result.' });
        } finally {
            setResultLoading(false);
        }
    }, [todaysMatchups, todaysMatchup, resultLoading, setGameResults, setCachedGameResults, userState.todaysPick, today, setUserState, addNotification, playSound, triggerHaptic]);

    // ✅ FIXED: Auto-fetch results for multiple games
    useEffect(() => {
        // Iterate through all today's matchups
        todaysMatchups.forEach(game => {
            const gameId = game.id;
            const existingResult = gameResults[gameId] || cachedGameResults[gameId];

            // Only fetch if game has started and we don't have result
            if (!game || !gameStarted || existingResult) return;
            
            const estimatedGameEnd = new Date(new Date(game.startTime).getTime() + (3 * 60 * 60 * 1000));
            const now = new Date();
            
            if (now > estimatedGameEnd) {
                fetchAndDisplayResult(gameId);
            } else {
                const timeUntilCheck = estimatedGameEnd.getTime() - now.getTime() + (30 * 60 * 1000);
                if (timeUntilCheck > 0) {
                    console.log(`Scheduling result check in ${Math.round(timeUntilCheck / 1000 / 60)} minutes for game ${gameId}.`);
                    const timerId = setTimeout(() => fetchAndDisplayResult(gameId), timeUntilCheck);
                    return () => clearTimeout(timerId);
                }
            }
        });
    }, [gameStarted, todaysMatchups, gameResults, cachedGameResults, fetchAndDisplayResult]);

    // ✅ FIX: Update game result when selected game changes
    useEffect(() => {
        if (todaysMatchup) {
            const gameId = todaysMatchup.id;
            const existingResult = gameResults[gameId] || cachedGameResults[gameId];
            setGameResult(existingResult || null);
        } else {
            setGameResult(null);
        }
    }, [todaysMatchup, gameResults, cachedGameResults]);

    // ✅ FIXED: Load cached results on page load
    useEffect(() => {
        if (todaysMatchup) {
            const gameId = todaysMatchup.id;
            const cachedResult = cachedGameResults[gameId];
            
            if (cachedResult) {
                const cachedResultDate = new Date(cachedResult.completedAt).toISOString().split('T')[0];
                if (cachedResultDate === today) {
                    setGameResults(prev => ({ ...prev, [gameId]: cachedResult }));
                    setGameResult(cachedResult); // ✅ Also set current game result
                }
            }
        }
    }, [todaysMatchup, cachedGameResults, today, setGameResults]);

    // ✅ Use gameResult instead of currentGameResult for display
    const currentGameResult = gameResult; // This now properly tracks the selected game


    const handleToggleTheme = useCallback(() => {
        setUserState(prev => ({
            ...prev,
            theme: prev.theme === 'dark' ? 'light' : 'dark'
        }));
        playSound('button_click');
        triggerHaptic('light');
    }, [setUserState, playSound, triggerHaptic]);

    const handleToggleSound = useCallback(() => {
        setUserState(prev => ({
            ...prev,
            soundEnabled: !prev.soundEnabled
        }));
        triggerHaptic('light');
        // playSound logic is inside useSound, so it will react to the state change
    }, [setUserState, triggerHaptic]);

    // Apply theme to body/html element
    useEffect(() => {
        document.documentElement.classList.remove('dark', 'light');
        document.documentElement.classList.add(userState.theme);
        // Set CSS variables for theme
        const root = document.documentElement;
        if (userState.theme === 'dark') {
            root.style.setProperty('--bg-primary', '#0a0a0a');
            root.style.setProperty('--bg-secondary', '#1a1a1a');
            root.style.setProperty('--bg-tertiary', '#2a2a2a');
            root.style.setProperty('--bg-quaternary', '#404040');
            root.style.setProperty('--text-primary', '#ffffff');
            root.style.setProperty('--text-secondary', '#a0a0a0');
        } else {
            root.style.setProperty('--bg-primary', '#ffffff');
            root.style.setProperty('--bg-secondary', '#f8fafc');
            root.style.setProperty('--bg-tertiary', '#e2e8f0');
            root.style.setProperty('--bg-quaternary', '#cbd5e1');
            root.style.setProperty('--text-primary', '#1e293b');
            root.style.setProperty('--text-secondary', '#64748b');
        }
    }, [userState.theme]);

    // Share tracking callback
    const handleShareComplete = useCallback((shareType, platform) => {
        // Update share stats
        setShareStats(prev => ({
            totalShares: prev.totalShares + 1,
            sharesByType: {
                ...prev.sharesByType,
                [shareType]: (prev.sharesByType[shareType] || 0) + 1
            },
            sharesByPlatform: {
                ...prev.sharesByPlatform,
                [platform]: (prev.sharesByPlatform[platform] || 0) + 1
            },
            lastShared: new Date().toISOString()
        }));

        // Show confirmation and play sound
        addNotification({
            type: 'success',
            message: `Shared your ${shareType}! Friends incoming...`
        });
        playSound('achievement_unlock'); // Using achievement sound for share success
    }, [addNotification, playSound, setShareStats]);

    // Auto-trigger share prompts for milestones
    useEffect(() => {
        // Show share modal for significant streaks
        const milestones = [5, 10, 15, 20, 25, 30];
        if (userState.currentStreak > 0 && milestones.includes(userState.currentStreak)) {
            // Don't spam - only show once per milestone
            const hasSharedThisMilestone = localStorage.getItem(`shared_milestone_${userState.currentStreak}_${userId}`);
            if (!hasSharedThisMilestone) {
                setTimeout(() => {
                    setShowShareModal(true);
                    localStorage.setItem(`shared_milestone_${userState.currentStreak}_${userId}`, 'true');
                }, 2000); // 2 second delay for celebration
            }
        }
    }, [userState.currentStreak, setShowShareModal, userId]);

    // Update leaderboard whenever user's streak or relevant stats change
    useEffect(() => {
        if (userState.displayName && userState.displayName !== 'AnonymousPicker') {
            updateLeaderboard();
        }
    }, [
        userState.currentStreak,
        userState.bestStreak,
        userState.totalPicks,
        userState.correctPicks,
        userState.weeklyStats?.correct,
        userState.displayName,
        updateLeaderboard
    ]);

    // Daily Reward System Check
    useEffect(() => {
        const checkDailyBonus = () => {
            const lastBonusDate = userState.lastDailyBonus ? new Date(userState.lastDailyBonus) : null;
            const now = new Date();
            const todayISO = now.toISOString().split('T')[0];

            if (!lastBonusDate || lastBonusDate.toISOString().split('T')[0] !== todayISO) {
                // It's a new day, grant bonus
                setUserState(prev => ({
                    ...prev,
                    coins: prev.coins + DAILY_BONUS_AMOUNT,
                    totalCoinsEarned: prev.totalCoinsEarned + DAILY_BONUS_AMOUNT,
                    lastDailyBonus: now.toISOString()
                }));
                setShowDailyRewardModal(true);
                playSound('coin_collect');
                addNotification({ type: 'success', message: `Daily bonus! +${DAILY_BONUS_AMOUNT} 🪙` });
            }
        };
        // Check only after initial load and if a real user (or test user but not anonymous)
        if (!matchupLoading && user && (!user.isAnonymous || user.isTestUser)) {
            checkDailyBonus();
        }
    }, [matchupLoading, user, userState.lastDailyBonus, setUserState, playSound, addNotification]);


    // Achievement System Check
    useEffect(() => {
        ACHIEVEMENTS_LIST.forEach(achievement => {
            if (!userState.achievements.includes(achievement.id) && achievement.checkCondition(userState)) {
                setUserState(prev => ({
                    ...prev,
                    achievements: [...prev.achievements, achievement.id],
                    coins: prev.coins + achievement.coinReward,
                    totalCoinsEarned: prev.totalCoinsEarned + achievement.coinReward
                }));
                setUnlockedAchievement(achievement);
                setShowAchievementModal(true);
                addNotification({ type: 'success', message: `Achievement unlocked: ${achievement.title}!` });
                playSound('achievement_unlock');
            }
        });
    }, [userState, setUserState, playSound, addNotification]); // Re-run when userState changes


    // Swipe gesture implementation
    const { onTouchStart, onTouchMove, onTouchEnd } = useSwipeGesture(
        () => handlePickInitiate('away'), // Swipe left for away team
        () => handlePickInitiate('home')  // Swipe right for home team
    );

    // FEATURE 2: Onboarding Tutorial - useEffect to show for new users
    const [hasSeenTutorial, setHasSeenTutorial] = useLocalStorage('hasSeenTutorial', false, userId);

    useEffect(() => {
      // Only show tutorial if:
      // 1. User hasn't seen it before
      // 2. Matchup is loaded
      // 3. There's a matchup available
      // 4. User has made 0 total picks
      if (!hasSeenTutorial && !matchupLoading && todaysMatchups.length > 0 && userState.totalPicks === 0) {
        setShowTutorial(true);
      }
    }, [hasSeenTutorial, matchupLoading, todaysMatchups, userState.totalPicks]);

    const handleNextTutorialStep = useCallback(() => {
        if (tutorialStep < TUTORIAL_TOTAL_STEPS - 1) {
            setTutorialStep(prev => prev + 1);
        } else {
            setHasSeenTutorial(true); // Mark as seen when tutorial finishes
            setShowTutorial(false);
            setTutorialStep(0); // Reset for next time (though won't show again)
        }
        triggerHaptic('light');
    }, [tutorialStep, setHasSeenTutorial, triggerHaptic]);

    const handleSkipTutorial = useCallback(() => {
        setHasSeenTutorial(true); // Mark as seen
        setShowTutorial(false);
        setTutorialStep(0); // Reset step
        triggerHaptic('light');
    }, [setHasSeenTutorial, triggerHaptic]);


    // Simple loading check - no complex logic
    if (matchupLoading) {
        return (
            <div className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center">
                <style>
                    {`
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap');
                    body { margin: 0; padding: 0; overflow-x: hidden; }
                    :root {
                        --bg-primary: #ffffff;
                        --bg-secondary: #f8fafc;
                        --bg-tertiary: #e2e8f0;
                        --text-primary: #1e293b;
                        --text-secondary: #64748b;
                        --accent-info: #3b82f6; /* Defined here for loading state */
                    }
                    .dark {
                        --bg-primary: #0a0a0a;
                        --bg-secondary: #1a1a1a;
                        --bg-tertiary: #2a2a2a;
                        --text-primary: #ffffff;
                        --text-secondary: #a0a0a0;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    .loader {
                        border-top-color: var(--accent-info);
                        animation: spin 1.2s linear infinite;
                    }
                    `}
                </style>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p>Loading Daily Matchup...</p>
                </div>
            </div>
        );
    }

    // CLEAN ERROR STATE - NO FALLBACKS
    if (!matchupLoading && todaysMatchups.length === 0) { // Changed condition
        return (
            <div className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center">
                <style>
                    {`
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap');
                    body { margin: 0; padding: 0; overflow-x: hidden; }
                    :root {
                        --bg-primary: #ffffff;
                        --bg-secondary: #f8fafc;
                        --bg-tertiary: #e2e8f0;
                        --text-primary: #1e293b;
                        --text-secondary: #64748b;
                        --accent-info: #3b82f6;
                        --accent-win: #22c55e;
                        --success: #10b981;
                        --error: #ef4444;
                    }
                    .dark {
                        --bg-primary: #0a0a0a;
                        --bg-secondary: #1a1a1a;
                        --bg-tertiary: #2a2a2a;
                        --text-primary: #ffffff;
                        --text-secondary: #a0a0a0;
                    }
                    `}
                </style>
                <div className="text-center p-6">
                    <h2 className="text-2xl font-bold mb-4">No Games Available</h2>
                    <p className="text-text-secondary mb-4">
                        No MLB games found for {new Date().toISOString().split('T')[0]}.
                    </p>
                    <p className="text-xs text-text-secondary mb-6">
                        This could mean it's an off-day or there's an API issue.
                        Please ensure your mobile browser is not requesting a "Desktop Site".
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg"
                    >
                        Retry Loading
                    </button>
                </div>
            </div>
        );
    }


    // Enhanced Header Component
    const EnhancedHeader = ({ userState, leaderboardData, onOpenLeaderboard }) => {
        const userRank = leaderboardData.userRank;

        return (
            <div className="text-center mb-8 pt-8 w-full">
                <div className="flex justify-between items-center mb-4 px-4">
                    <RankBadge rank={userRank} streak={userState.currentStreak} className="min-w-[90px]"/>
                    <h1 className="text-3xl font-bold text-text-primary text-center flex-1">Streak Picks</h1>
                    <button
                        onClick={onOpenLeaderboard}
                        className="leaderboard-btn text-3xl p-2 rounded-full hover:bg-bg-tertiary transition-colors"
                        aria-label="Open leaderboard"
                    >
                        🏆
                    </button>
                </div>

                <AnimatedStreakDisplay
                    currentStreak={userState.currentStreak}
                    bestStreak={userState.bestStreak}
                    isIncreasing={isStreakIncreasing}
                />
            </div>
        );
    };


    return (
        <div
            className="min-h-screen bg-bg-primary text-text-primary font-inter p-4 flex flex-col items-center relative overflow-hidden transition-colors duration-300 app-background" // Added app-background
            style={{
                // This section sets the CSS variables for the entire application,
                // making them accessible to TailwindCSS classes and custom CSS.
                // These are dynamically updated by the theme toggle.
                '--bg-primary': 'var(--bg-primary)',
                '--bg-secondary': 'var(--bg-secondary)',
                '--bg-tertiary': 'var(--bg-tertiary)',
                '--bg-quaternary': 'var(--bg-quaternary)',
                '--success': '#10b981',
                '--success-light': '#6ee7b7',
                '--error': '#ef4444',
                '--error-light': '#fca5a5',
                '--warning': '#f59e0b',
                '--info': '#3b82f6',
                '--info-light': '#93c5fd',
                '--text-primary': 'var(--text-primary)',
                '--text-secondary': 'var(--text-secondary)',
                '--accent-win': '#22c55e', // Specific accent color for wins
                '--accent-loss': '#ef4444', // Specific accent color for losses
                '--accent-info': '#3b82f6', // Re-using --info for accent-info
                '--font-primary': "'Inter', system-ui, -apple-system, sans-serif",
                '--font-mono': "'SF Mono', Monaco, 'Cascadia Code', monospace",
                '--space-xs': '0.25rem',
                '--space-sm': '0.5rem',
                '--space-md': '1rem',
                '--space-lg': '1.5rem',
                '--space-xl': '2rem',
                '--space-2xl': '3rem',
                '--radius-sm': '0.375rem',
                '--radius-md': '0.5rem',
                '--radius-lg': '0.75rem',
                '--radius-xl': '1rem',
                '--radius-2xl': '1.5rem',
                '--shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                '--shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                '--shadow-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                '--transition-fast': '150ms ease-out',
                '--transition-normal': '250ms ease-out',
                '--transition-slow': '400ms ease-out',
            }}
        >
            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap');
                body { margin: 0; padding: 0; overflow-x: hidden; }
                
                /* FORCE CONSISTENT COLORS EVERYWHERE */
                :root {
                    --bg-primary: #ffffff;
                    --bg-secondary: #f8fafc;
                    --bg-tertiary: #e2e8f0;
                    --text-primary: #1e293b;
                    --text-secondary: #64748b;
                    --accent-info: #3b82f6;
                    --accent-win: #22c55e;
                    --success: #10b981;
                    --error: #ef4444;
                }

                .dark {
                    --bg-primary: #0a0a0a;
                    --bg-secondary: #1a1a1a;
                    --bg-tertiary: #2a2a2a;
                    --text-primary: #ffffff;
                    --text-secondary: #a0a0a0;
                }

                /* Enhanced Gradient Background for the App */
                .app-background {
                    background: 
                        radial-gradient(circle at 20% 50%, var(--accent-info)10 0%, transparent 50%),
                        radial-gradient(circle at 80% 20%, var(--accent-win)08 0%, transparent 50%),
                        var(--bg-primary);
                    background-size: cover;
                    background-attachment: fixed;
                }

                /* PREMIUM MATCHUP CARD */
                .matchup-card {
                    background: linear-gradient(135deg, 
                        var(--bg-secondary) 0%, 
                        color-mix(in srgb, var(--accent-info) 8%, var(--bg-secondary)) 50%,
                        var(--bg-secondary) 100%
                    );
                    border: 1px solid color-mix(in srgb, var(--info) 10%, transparent);
                    border-radius: var(--radius-2xl);
                    box-shadow: var(--shadow-lg);
                    backdrop-filter: blur(20px);
                    position: relative;
                    overflow: hidden;
                    transition: all var(--transition-normal);
                }

                .matchup-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: linear-gradient(90deg, var(--info), var(--success), var(--warning));
                    opacity: 0.6;
                }

                /* PERFECT TEAM CARD IMPLEMENTATION */
                .team-selection-container {
                    display: grid;
                    grid-template-columns: 1fr 60px 1fr;
                    gap: var(--space-lg);
                    align-items: stretch;
                    width: 100%;
                    max-width: 400px;
                    margin: 0 auto;
                    padding: var(--space-lg);
                }

                /* TEAM CARD COLOR IMPLEMENTATION - FIXED */
                .team-card {
                    /* Remove the old background and use CSS variables properly */
                    background: linear-gradient(135deg, 
                        rgba(var(--team-primary-rgb), 0.15), 
                        rgba(var(--team-secondary-rgb), 0.08), 
                        var(--bg-secondary)
                    ) !important; /* Force override */
                    
                    border: 2px solid rgba(var(--team-primary-rgb), 0.4) !important;
                    
                    /* Rest of existing styles... */
                    min-height: 160px;
                    width: 100%;
                    aspect-ratio: 3/4;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: var(--space-sm);
                    border-radius: var(--radius-xl);
                    padding: var(--space-lg);
                    position: relative;
                    overflow: hidden;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    transform: scale(1);
                    outline: none;
                }

                .team-card:focus-visible {
                    box-shadow: 0 0 0 2px var(--info), 0 0 0 4px var(--info-light);
                    outline: none;
                }

                .team-card:hover:not(.disabled) {
                    transform: translateY(-4px) scale(1.03) !important;
                    background: linear-gradient(135deg, 
                        rgba(var(--team-primary-rgb), 0.25), 
                        rgba(var(--team-secondary-rgb), 0.15), 
                        var(--bg-secondary)
                    ) !important;
                    border-color: rgb(var(--team-primary-rgb)) !important;
                    box-shadow: 
                        0 20px 25px -5px rgba(0, 0, 0, 0.2),
                        0 0 30px rgba(var(--team-primary-rgb), 0.4) !important;
                }

                .team-card.selected {
                    background: linear-gradient(135deg, 
                        rgba(var(--team-primary-rgb), 0.35), 
                        rgba(var(--team-secondary-rgb), 0.20), 
                        var(--bg-secondary)
                    ) !important;
                    border-color: rgb(var(--team-primary-rgb)) !important;
                    transform: scale(1.05) !important;
                    animation: team-select 0.3s ease-out;
                }
                
                /* Enhanced glow effect for selected card */
                .team-card.selected::before {
                    content: '';
                    position: absolute;
                    inset: -2px;
                    background: linear-gradient(45deg, 
                        rgb(var(--team-primary-rgb)), 
                        rgb(var(--team-secondary-rgb))
                    );
                    border-radius: inherit;
                    z-index: -1;
                    opacity: 0.3;
                    filter: blur(8px);
                }


                .team-card.disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }

                .vs-divider {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: var(--text-secondary);
                    background: var(--bg-tertiary);
                    border-radius: 50%;
                    width: 60px;
                    height: 60px;
                    box-shadow: var(--shadow-md);
                }

                /* ENHANCED ANIMATIONS */
                @keyframes team-select {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1.02); }
                }

                @keyframes pulse-success {
                    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--success) 40%, transparent); }
                    70% { box-shadow: 0 0 0 10px transparent; }
                }

                .team-card.selected {
                    animation: team-select 0.3s ease-out;
                }

                .streak-celebration {
                    animation: pulse-success 2s infinite;
                }

                /* ✅ Enhanced color accent styling */
                .color-accent {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 4px; /* Default height */
                    border-radius: 0 0 var(--radius-xl) var(--radius-xl);
                    transition: height 0.3s ease;
                }

                .team-card:hover .color-accent {
                    height: 6px; /* Slightly taller on hover */
                }

                /* Pulse animation for selected card */
                .team-card.selected .color-accent {
                    animation: colorPulse 2s ease-in-out infinite;
                }

                @keyframes colorPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }

                /* MOBILE OPTIMIZATIONS */
                @media (max-width: 640px) {
                    .team-selection-container {
                        grid-template-columns: 1fr 50px 1fr;
                        gap: var(--space-md);
                        padding: var(--space-md);
                    }
                    
                    .team-card {
                        min-height: 140px;
                        padding: var(--space-md);
                    }
                    
                    .vs-divider {
                        width: 50px;
                        height: 50px;
                        font-size: 1rem;
                    }
                }

                /* LOADING STATES */
                .loading-shimmer {
                    background: linear-gradient(90deg, 
                        transparent, 
                        color-mix(in srgb, var(--bg-tertiary) 50%, transparent), 
                        transparent
                    );
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite;
                }

                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }

                /* General animations */
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                
                .animate-fadeInUp { animation: fadeInUp 0.5s ease-out forwards; }
                .animate-slideInRight { animation: slideInRight 0.5s ease-out forwards; }
                .animate-bounce { animation: bounce 1s infinite; }
                .animate-pulse { animation: pulse 1.5s infinite; }


                /* Leaderboard Styles */
                .leaderboard-modal {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.9);
                backdrop-filter: blur(8px);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
                }

                .leaderboard-content {
                background: var(--bg-secondary);
                border-radius: 24px;
                max-width: 500px;
                width: 100%;
                max-height: 90vh; /* Adjusted for better fit */
                overflow-y: auto;
                border: 2px solid var(--bg-tertiary);
                box-shadow: 0 10px 40px rgba(0,0,0,0.5); /* Stronger shadow */
                }

                .leaderboard-tabs {
                display: flex;
                border-bottom: 2px solid var(--bg-tertiary);
                }

                .leaderboard-tab {
                flex: 1;
                padding: 16px;
                text-align: center;
                background: transparent;
                border: none;
                cursor: pointer;
                transition: all 0.3s ease;
                color: var(--text-secondary); /* Default tab text color */
                }

                .leaderboard-tab.active {
                background: var(--accent-info);
                color: white;
                }

                .leaderboard-entry {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid var(--bg-tertiary);
                transition: background 0.2s ease;
                }

                .leaderboard-entry:last-child {
                    border-bottom: none;
                }

                .leaderboard-entry:hover {
                background: var(--bg-tertiary);
                }

                .leaderboard-entry.current-user {
                background: var(--accent-info)20; /* Lighter background */
                border-left: 4px solid var(--accent-info);
                }

                /* Rank Badge Styles */
                .rank-badge {
                display: inline-flex;
                align-items: center;
                justify-content: center; /* Center content horizontally */
                padding: 8px 12px;
                border-radius: 20px;
                font-weight: bold;
                font-size: 0.875rem;
                color: var(--text-primary); /* Default color for non-special ranks */
                min-width: 90px; /* Ensure consistent width */
                }

                .rank-badge.top-10 {
                background: linear-gradient(135deg, #FFD700, #FFA500); /* Gold */
                color: #1a1a1a; /* Dark text on gold */
                animation: pulse-gold 2s infinite;
                }

                .rank-badge.top-50 {
                background: linear-gradient(135deg, #C0C0C0, #A0A0A0); /* Silver */
                color: #1a1a1a;
                }
                
                .rank-badge.top-100 {
                background: linear-gradient(135deg, #CD7F32, #8B4513); /* Bronze */
                color: #fff;
                }
                .rank-badge.standard {
                    background: var(--bg-tertiary);
                    color: var(--text-primary);
                }

                /* Animated Streak Styles */
                .streak-display-container {
                text-align: center;
                }

                .streak-number {
                font-size: 4rem;
                font-weight: 800;
                line-height: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                transition: all 0.5s ease;
                color: var(--text-primary); /* Default color */
                }

                .streak-number.celebrating {
                animation: celebrate 1s ease-in-out;
                color: var(--accent-win);
                }

                .streak-flame {
                animation: flicker 1.5s infinite;
                }

                @keyframes celebrate {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
                }

                @keyframes flicker {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
                }

                @keyframes pulse-gold {
                0%, 100% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.7); }
                70% { box-shadow: 0 0 0 8px rgba(255, 215, 0, 0); }
                }

                /* Mobile timer and date fixes */
                @media (max-width: 640px) {
                    .team-selection-container {
                        grid-template-columns: 1fr 50px 1fr;
                        gap: var(--space-md);
                        padding: var(--space-md);
                    }
                    
                    .team-card {
                        min-height: 140px;
                        padding: var(--space-md);
                    }
                    
                    .vs-divider {
                        width: 50px;
                        height: 50px;
                        font-size: 1rem;
                    }
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;  /* IE and Edge */
                    scrollbar-width: none;  /* Firefox */
                }
                `}
            </style>
            <script src="https://cdn.tailwindcss.com"></script>

            <div className="max-w-md mx-auto w-full animate-fadeInUp">

                {/* Enhanced Header - Streak Display & Rank */}
                <EnhancedHeader
                    userState={userState}
                    leaderboardData={leaderboardData}
                    onOpenLeaderboard={() => setShowLeaderboard(true)}
                />

                {/* FEATURE 3: Multi-Game System - Game Selector */}
                {todaysMatchups.length > 1 && (  
                    <GameSelector     
                        games={todaysMatchups}    
                        selectedIndex={selectedGameIndex}    
                        onSelect={setSelectedGameIndex}  
                    />
                )}

                {/* Today's Matchup Card */}
                {todaysMatchup && ( // Only render if a matchup is selected
                    <div className="matchup-card mb-6"
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                    > {/* Applied matchup-card styling */}
                        <div className="flex justify-between items-center mb-4 px-6 pt-6"> {/* Added padding to align with matchup-card */}
                            <span className="bg-accent-info text-xs px-3 py-1 rounded-full font-semibold text-white">
                                {todaysMatchup.sport}
                            </span>
                            {/* Data source will always be live now */}
                            <span className="text-xs text-text-secondary">
                                📡 Live
                            </span>
                            <span className="text-text-secondary text-xs">{todaysMatchup.venue}</span>
                        </div>

                        {/* Team vs Team using the new team-selection-container grid */}
                        <div className="team-selection-container">
                            <EnhancedTeamCard
                                team={todaysMatchup.homeTeam}
                                isSelected={userState.todaysPick?.matchupId === todaysMatchup.id && userState.todaysPick?.selectedTeam === 'home'}
                                isPicked={userState.todaysPick?.matchupId === todaysMatchup.id && userState.todaysPick?.selectedTeam === 'home'}
                                onClick={() => handlePickInitiate('home')}
                                disabled={hasPickedToday || gameStarted}
                            />

                            <div className="vs-divider">VS</div>

                            <EnhancedTeamCard
                                team={todaysMatchup.awayTeam}
                                isSelected={userState.todaysPick?.matchupId === todaysMatchup.id && userState.todaysPick?.selectedTeam === 'away'}
                                isPicked={userState.todaysPick?.matchupId === todaysMatchup.id && userState.todaysPick?.selectedTeam === 'away'}
                                onClick={() => handlePickInitiate('away')}
                                disabled={hasPickedToday || gameStarted}
                            />
                        </div>

                        {/* Betting Interface */}
                        {!hasPickedToday && !gameStarted && (
                            <BettingInterface 
                                onBetChange={setBetAmount} 
                                userCoins={userState.coins} 
                                currentBet={betAmount} 
                            />
                        )}

                        {/* Enhanced Game Time Display */}
                        <div className="text-center mb-6 px-6">
                            {todaysMatchup?.startTime ? (
                                <EnhancedGameTimeDisplay 
                                    startTime={todaysMatchup.startTime} 
                                    setTimeLeft={setTimeLeft}
                                    matchupId={todaysMatchup.id}
                                />
                            ) : (
                                <div className="text-red-500">⚠️ No game time available</div>
                            )}
                            
                            {/* Show game result if available, otherwise show timer */}
                            {currentGameResult ? (
                                <div>
                                    <p className="text-lg font-semibold text-accent-win mb-2">
                                        🏆 Game Finished!
                                    </p>
                                    <GameResultDisplay 
                                        result={currentGameResult} 
                                        todaysMatchup={todaysMatchup} 
                                        userPick={userState.todaysPick} 
                                    />
                                </div>
                            ) : (
                                <p className="text-lg font-semibold text-text-primary">
                                    ⏰ Starts in: <span className="font-mono">{timeLeft || 'Calculating...'}</span>
                                </p>
                            )}
                        </div>
                        
                        {/* Pick Buttons or Result (now handled by EnhancedTeamCard's disabled state) */}
                        {(hasPickedToday || gameStarted) && (
                            <div className="text-center bg-bg-tertiary rounded-b-2xl p-4 border-t border-text-secondary/20"> {/* Changed to rounded-b-2xl for matchup-card integration */}
                                <p className="font-semibold text-text-primary">
                                    {hasPickedToday ?
                                        `✅ You picked: ${userState.todaysPick.selectedTeam === 'home' ? todaysMatchup.homeTeam.name : todaysMatchup.awayTeam.name}` :
                                        '🔒 Game has started!'
                                    }
                                </p>
                                <p className="text-sm text-text-secondary mt-1">Come back tomorrow for a new matchup!</p>
                                {/* Share Pick Button (Option B) */}
                                {hasPickedToday && userState.currentStreak > 0 && (
                                    <div className="mt-4 text-center">
                                        <EnhancedButton
                                            onClick={() => setShowShareModal(true)}
                                            className="bg-green-600 hover:bg-green-700 text-white"
                                        >
                                            📱 Share This Pick
                                        </EnhancedButton>
                                    </div>
                                )}

                                {/* Manual check button - ensure it passes the correct game ID */}
                                {gameStarted && !currentGameResult && (    
                                    <div className="mt-3">        
                                        <EnhancedButton            
                                            onClick={() => fetchAndDisplayResult(todaysMatchup.id)} // ✅ Always pass the game ID            
                                            loading={resultLoading}            
                                            className="bg-blue-600 hover:bg-blue-700 text-white text-sm"        
                                        >            
                                            {resultLoading ? 'Checking...' : '🔍 Check Game Result'}        
                                        </EnhancedButton>    
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}


                {/* Leaderboard Preview Section */}
                <div className="leaderboard-section mb-6">
                    <LeaderboardPreview
                        leaderboardData={leaderboardData}
                        userState={userState}
                        onOpenFull={() => setShowLeaderboard(true)}
                        userCount={leaderboardData.users.length} // Pass the total user count
                    />
                </div>


                {/* Simple Stats - Replaced with Enhanced StatsCard */}
                <div className="grid grid-cols-3 gap-4 text-center mb-6">
                    <StatsCard title="Total Picks" value={userState.totalPicks} color="text-accent-info" />
                    <StatsCard title="Correct" value={userState.correctPicks} color="text-accent-win" />
                    <StatsCard 
                        title="Accuracy" 
                        value={`${userState.totalPicks > 0 ? Math.round((userState.correctPicks / userState.totalPicks) * 100) : 0}%`} 
                        color="text-purple-400" 
                    />
                    <StatsCard title="Coins" value={`${userState.coins} 🪙`} color="text-yellow-400" />
                    <StatsCard title="Earned" value={`${userState.totalCoinsEarned} 🪙`} color="text-green-400" />
                    <StatsCard title="Spent" value={`${userState.totalCoinsSpent} 🪙`} color="text-red-400" />
                </div>

                {/* Enhanced Settings with Logout */}
                <div className="bg-bg-secondary p-4 rounded-xl shadow-md border border-bg-tertiary">
                    <div className="grid grid-cols-2 gap-3 mb-3 settings-grid">
                        <EnhancedButton
                            onClick={handleToggleTheme}
                            className="bg-accent-info text-white"
                            aria-label={`Toggle theme, current is ${userState.theme}`}
                        >
                            {userState.theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
                        </EnhancedButton>
                        <EnhancedButton
                            onClick={() => handleToggleSound()}
                            className={`${userState.soundEnabled ? 'bg-accent-win text-white' : 'bg-gray-500 text-white'}`}
                            aria-label={`Toggle sound effects, currently ${userState.soundEnabled ? 'on' : 'off'}`}
                        >
                            🔊 Sound
                        </EnhancedButton>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3 settings-grid">
                        <EnhancedButton
                            onClick={() => setShowShareModal(true)}
                            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                            aria-label="Share the app"
                        >
                            📱 Share
                        </EnhancedButton>
                        {/* FEATURE 1: Pick History Page - History button */}
                        <EnhancedButton  
                            onClick={() => setShowPickHistory(true)}  
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >  
                            📊 History
                        </EnhancedButton>
                        <EnhancedButton
                            onClick={async () => {
                                try {
                                    // FIX: Use complete URL for logout as well
                                    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                                    const response = await fetch(`${baseUrl}/api/auth/logout`, {
                                        method: 'POST',
                                        credentials: 'include'
                                    });
                                    if (response.ok) {
                                        window.location.href = '/';
                                    }
                                } catch (error) {
                                    console.error('Logout error:', error);
                                    // Fallback: just reload the page
                                    window.location.reload();
                                }
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white col-span-2" // Make logout button span 2 columns
                            aria-label="Logout from Whop account"
                        >
                            🚪 Logout
                        </EnhancedButton>
                    </div>
                </div>
            </div>

            {/* Floating Notifications */}
            {notifications.length > 0 && (
                <div className="fixed top-4 right-4 z-50 w-full max-w-xs p-2 animate-slideInRight">
                    <div className={`${notifications[notifications.length - 1].type === 'success' ? 'bg-green-600' :
                        notifications[notifications.length - 1].type === 'error' ? 'bg-red-600' :
                        notifications[notifications.length - 1].type === 'warning' ? 'bg-yellow-600' :
                        'bg-blue-600'} text-white rounded-xl shadow-lg p-3 flex items-center justify-between`}>
                        <p className="font-semibold text-sm">
                            {notifications[notifications.length - 1].message}
                        </p>
                        <button
                            onClick={() => dismissNotification(notifications[notifications.length - 1].id)}
                            className="ml-2 text-white opacity-75 hover:opacity-100 text-xl leading-none"
                            aria-label="Dismiss notification"
                        >
                            &times;
                        </button>
                    </div>
                </div>
            )}

            {/* Pick Confirmation Modal */}
            <PickConfirmationModal
                isOpen={showPickConfirmationModal}
                onClose={() => setShowPickConfirmationModal(false)}
                onConfirm={confirmPick}
                selectedTeam={teamToConfirm}
                matchup={todaysMatchup} // Pass the selected matchup
                betAmount={betAmount}
                userCoins={userState.coins}
            />

            {/* Daily Reward Modal */}
            <DailyRewardModal
                isOpen={showDailyRewardModal}
                onClose={() => setShowDailyRewardModal(false)}
                rewardAmount={DAILY_BONUS_AMOUNT}
            />

            {/* Achievement Unlocked Modal */}
            <AchievementUnlockedModal
                isOpen={showAchievementModal}
                onClose={() => setShowAchievementModal(false)}
                achievement={unlockedAchievement}
            />

            {/* Share Modal */}
            <ShareModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                userState={userState}
                todaysMatchup={todaysMatchup} // Pass the selected matchup
                onShare={handleShareComplete}
                addNotification={addNotification} // Pass addNotification to ShareModal
            />

            {/* Leaderboard Modal */}
            <LeaderboardModal
                isOpen={showLeaderboard}
                onClose={() => setShowLeaderboard(false)}
                userState={userState}
                leaderboardData={leaderboardData}
                onRefreshLeaderboard={refreshLeaderboard} // Use the new refresh function
                userId={userId}
            />

            {/* FEATURE 1: Pick History Page - Modal */}
            <PickHistoryModal
                isOpen={showPickHistory}
                onClose={() => setShowPickHistory(false)}
                pickHistory={userState.pickHistoryData}
                todaysMatchups={todaysMatchups} // Pass all matchups for potential lookup if needed
            />

            {/* FEATURE 2: Onboarding Tutorial - Modal */}
            <TutorialModal
                isOpen={showTutorial}
                step={tutorialStep}
                onNext={handleNextTutorialStep}
                onClose={handleSkipTutorial}
                totalSteps={TUTORIAL_TOTAL_STEPS}
            />

            {/* Floating Share Button */}
            <FloatingShareButton onClick={() => setShowShareModal(true)} />

        </div>
    );
};

// --- Whop Integration Wrapper ---

export default function Page() {
    const { user, isLoading, isAuthenticated, hasAccess, error } = useWhop();
    const [isWhopUser, setIsWhopUser] = useState(false);

    useEffect(() => {
        // Check if user is a real Whop user (not test/anonymous)
        if (isAuthenticated && user && !user.isTestUser && !user.isAnonymous) {
            setIsWhopUser(true);
            console.log('✅ Real Whop user detected');
        } else {
            setIsWhopUser(false);
            if (user?.isTestUser) {
                console.log('🧪 Test user mode');
            } else if (user?.isAnonymous) {
                console.log('👤 Anonymous user mode');
            }
        }
    }, [user, isAuthenticated]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p>Connecting to Whop...</p>
                </div>
            </div>
        );
    }

    // Show different banners based on user type
    const getBanner = () => {
        if (isWhopUser) {
            return null; // No banner for real Whop users
        } else if (user?.isTestUser && !user?.isAnonymous) {
            return (
                <div className="bg-blue-100 border-b border-blue-300 p-2 text-center text-sm">
                    🧪 <strong>Test Mode:</strong> Using test user account for development.
                </div>
            );
        } else {
            return (
                <div className="bg-yellow-100 border-b border-yellow-300 p-2 text-center text-sm">
                    👤 <strong>Demo Mode:</strong> Anonymous user. 
                    {window.location.hostname !== 'localhost' && ' Sign in through Whop for full features.'}
                </div>
            );
        }
    };

    return (
        <div>
            {getBanner()}
            <App user={user} />
        </div>
    );
}
