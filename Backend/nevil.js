//searching songs by artist name
const searchSongsByArtist = async (req, res) => {
    const { artistName } = req.body;

    if (!artistName) {
        return res.json({ success: false, message: "Artist name is required" });
    }

    try {
        const [rows] = await db.query(
            `SELECT songID, songName, ArtistName
FROM newsong
JOIN artists  ON newsong.ArtistID = artists.ArtistID
WHERE ArtistName = ?`,
            [artistName]
        );

        if (rows.length === 0) {
            return res.json({ success: false, message: "No songs found for this artist" });
        }

        return res.json({ success: true, songs: rows });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

//creating playlist for user
const createPlaylist = async (req, res) => {
    const { playlistName, userId } = req.body;

    //Validate input
    if (!playlistName || !userId) {
        return res.json({ success: false, message: "Missing playlist name or user ID" });
    }

    try {
        //Check if user exists
        const [userRows] = await db.query(
            "SELECT COUNT(*) AS count FROM User WHERE User_ID = ?",
            [userId]
        );
        if (userRows[0].count === 0) {
            return res.json({ success: false, message: "User not found" });
        }

        //Check if the same playlist name already exists for the user
        const [existingPlaylist] = await db.query(
            "SELECT * FROM playlist WHERE Playlist_Name = ? AND User_ID = ?",
            [playlistName, userId]
        );
        if (existingPlaylist.length > 0) {
            return res.json({ success: false, message: "Playlist already exists for this user" });
        }

        //Generate new Playlist_ID
        const [lastPlaylist] = await db.query(
            "SELECT Playlist_ID FROM playlist ORDER BY Playlist_ID DESC LIMIT 1"
        );

        let newPlaylistId = "PL001"; // default if no playlists exist
        if (lastPlaylist.length > 0) {
            const lastId = lastPlaylist[0].Playlist_ID; // e.g., "PL007"
            const num = parseInt(lastId.slice(2)) + 1;
            newPlaylistId = "PL" + num.toString().padStart(3, "0");
        }

        //Insert new playlist
        await db.query(
            "INSERT INTO playlist (Playlist_ID, Playlist_Name, User_ID) VALUES (?, ?, ?)",
            [newPlaylistId, playlistName, userId]
        );

        return res.json({
            success: true,
            message: "Playlist created successfully",
            playlistId: newPlaylistId
        });

    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

//adding songs into the playlist
const addSongToPlaylist = async (req, res) => {
    const { playlistName, userId, songId } = req.body;

    //Validate input
    if (!playlistName || !userId || !songId) {
        return res.json({ success: false, message: "Missing playlist name, user ID, or song ID" });
    }

    try {
        //Get Playlist_ID from playlist name and user ID
        const [playlistRows] = await db.query(
            "SELECT Playlist_ID FROM playlist WHERE Playlist_Name = ? AND User_ID = ?",
            [playlistName, userId]
        );

        if (playlistRows.length === 0) {
            return res.json({ success: false, message: "Playlist not found for this user" });
        }

        const playlistId = playlistRows[0].Playlist_ID;

        //Check if song exists
        const [songRows] = await db.query(
            "SELECT COUNT(*) AS count FROM newsong WHERE songID = ?",
            [songId]
        );
        if (songRows[0].count === 0) {
            return res.json({ success: false, message: "Song not found" });
        }

        //Check if song is already in playlist
        const [existing] = await db.query(
            "SELECT COUNT(*) AS count FROM playlist_songs WHERE Playlist_ID = ? AND Song_ID = ?",
            [playlistId, songId]
        );
        if (existing[0].count > 0) {
            return res.json({ success: false, message: "Song already in playlist" });
        }

        //Insert into playlist_songs
        await db.query(
            "INSERT INTO playlist_songs (Playlist_ID, Song_ID) VALUES (?, ?)",
            [playlistId, songId]
        );

        return res.json({ success: true, message: "Song added to playlist" });

    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

//deleting song from the playlist
const removeSongFromPlaylist = async (req, res) => {
    const { playlistName, userId, songId } = req.body;

    //Validate input
    if (!playlistName || !userId || !songId) {
        return res.json({ success: false, message: "Missing playlist name, user ID, or song ID" });
    }

    try {
        //Get Playlist_ID
        const [playlistRows] = await db.query(
            "SELECT Playlist_ID FROM playlist WHERE Playlist_Name = ? AND User_ID = ?",
            [playlistName, userId]
        );

        if (playlistRows.length === 0) {
            return res.json({ success: false, message: "Playlist not found for this user" });
        }

        const playlistId = playlistRows[0].Playlist_ID;

        //Check if song exists in the playlist
        const [songInPlaylist] = await db.query(
            "SELECT COUNT(*) AS count FROM playlist_songs WHERE Playlist_ID = ? AND Song_ID = ?",
            [playlistId, songId]
        );

        if (songInPlaylist[0].count === 0) {
            return res.json({ success: false, message: "Song not found in playlist" });
        }

        //Delete song from playlist
        await db.query(
            "DELETE FROM playlist_songs WHERE Playlist_ID = ? AND Song_ID = ?",
            [playlistId, songId]
        );

        return res.json({ success: true, message: "Song removed from playlist" });

    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

//deleting playlist 
const deletePlaylist = async (req, res) => {
    const { playlistName, userId } = req.body;

    // Validate input
    if (!playlistName || !userId) {
        return res.json({ success: false, message: "Missing playlist name or user ID" });
    }

    try {
        // Find the Playlist_ID
        const [playlistRows] = await db.query(
            "SELECT Playlist_ID FROM playlist WHERE Playlist_Name = ? AND User_ID = ?",
            [playlistName, userId]
        );

        if (playlistRows.length === 0) {
            return res.json({ success: false, message: "Playlist not found for this user" });
        }

        const playlistId = playlistRows[0].Playlist_ID;

        //  Delete related entries from playlist_songs (if any)
        await db.query(
            "DELETE FROM playlist_songs WHERE Playlist_ID = ?",
            [playlistId]
        );

        // Delete the playlist itself
        await db.query(
            "DELETE FROM playlist WHERE Playlist_ID = ?",
            [playlistId]
        );

        return res.json({ success: true, message: "Playlist deleted successfully" });

    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};


//get recommended songs based on the artists in their playlists 
const getRecommendedSongs = async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.json({ success: false, message: "Missing user ID" });
    }

    try {
        const [recommendedSongs] = await db.query(
            `
            SELECT newsong.songID, newsong.songName, artists.ArtistName, newsong.AlbumReleaseDate
FROM newsong 
JOIN artists ON newsong.artistID = artists.ArtistID
WHERE newsong.artistID IN (
    SELECT DISTINCT newsong.artistID
    FROM playlist 
    JOIN playlist_songs ON playlist.Playlist_ID = playlist_songs.Playlist_ID
    JOIN newsong  ON playlist_songs.Song_ID = newsong.songID
    WHERE playlist.User_ID = ?
)
AND newsong.songID NOT IN (
    SELECT playlist_songs.Song_ID
    FROM playlist 
    JOIN playlist_songs  ON playlist.Playlist_ID = playlist_songs.Playlist_ID
    WHERE playlist.User_ID = ?
)
ORDER BY newsong.AlbumReleaseDate DESC
LIMIT 10;
            `,
            [userId, userId]
        );

        return res.json({ success: true, recommendations: recommendedSongs });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

const getPlaylistByName = async (req, res) => {
    const { userId, playlistName } = req.body;

    if (!userId || !playlistName) {
        return res.json({ success: false, message: "Missing userId or playlistName" });
    }

    try {
        //Check if user exists
        const [userRows] = await db.query("SELECT * FROM User WHERE User_ID = ?", [userId]);
        if (userRows.length === 0) {
            return res.json({ success: false, message: "User does not exist" });
        }

        //Check if playlist exists for that user
        const [playlistRows] = await db.query(
            "SELECT * FROM playlist WHERE Playlist_Name = ? AND User_ID = ?",
            [playlistName, userId]
        );
        if (playlistRows.length === 0) {
            return res.json({ success: false, message: "Playlist not found for this user" });
        }

        //Return playlist info
        return res.json({ success: true, playlist: playlistRows[0] });

    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

//search songs by songname
const searchSongByName = async (req, res) => {
    const { songName } = req.body;

    if (!songName) {
        return res.json({ success: false, message: "Missing song name to search" });
    }

    try {
        const [songs] = await db.query(
            `SELECT 
                ns.songID, 
                ns.songName, 
                a.ArtistName, 
                ns.DurationMS, 
                ns.SpotifyURL
            FROM newsong ns
            JOIN artists a ON ns.artistID = a.ArtistID
            WHERE ns.songName LIKE CONCAT('%', ?, '%')
            ORDER BY ns.songName = ? DESC`,
            [songName, songName]
        );

        return res.json({ success: true, songs });

    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

//rename playlist name
const renamePlaylist = async (req, res) => {
    const { username, oldPlaylistName, newPlaylistName } = req.body;

    //Validate input
    if (!username || !oldPlaylistName || !newPlaylistName) {
        return res.json({ success: false, message: "Missing required fields" });
    }

    try {
        //Get User_ID from username
        const [userRows] = await db.query("SELECT User_ID FROM User WHERE userName = ?", [username]);
        if (userRows.length === 0) {
            return res.json({ success: false, message: "User does not exist" });
        }
        const userID = userRows[0].User_ID;

        //Check if the playlist exists for this user
        const [playlistRows] = await db.query(
            "SELECT * FROM playlist WHERE Playlist_Name = ? AND User_ID = ?",
            [oldPlaylistName, userID]
        );
        if (playlistRows.length === 0) {
            return res.json({ success: false, message: "Playlist not found for this user" });
        }

        //Check if the new playlist name already exists for this user
        const [duplicateCheck] = await db.query(
            "SELECT * FROM playlist WHERE Playlist_Name = ? AND User_ID = ?",
            [newPlaylistName, userID]
        );
        if (duplicateCheck.length > 0) {
            return res.json({ success: false, message: "A playlist with the new name already exists" });
        }

        //Rename the playlist
        await db.query(
            "UPDATE playlist SET Playlist_Name = ? WHERE Playlist_Name = ? AND User_ID = ?",
            [newPlaylistName, oldPlaylistName, userID]
        );

        return res.json({ success: true, message: "Playlist renamed successfully" });

    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

//display total duration of the playlist
const getPlaylistDuration = async (req, res) => {
    const { username, playlistName } = req.body;

    if (!username || !playlistName) {
        return res.json({ success: false, message: "Missing username or playlist name" });
    }

    try {
        //Get User_ID from username
        const [userRows] = await db.query("SELECT User_ID FROM User WHERE userName = ?", [username]);
        if (userRows.length === 0) {
            return res.json({ success: false, message: "User does not exist" });
        }
        const userID = userRows[0].User_ID;

        //Get Playlist_ID
        const [playlistRows] = await db.query(
            "SELECT Playlist_ID FROM playlist WHERE Playlist_Name = ? AND User_ID = ?",
            [playlistName, userID]
        );
        if (playlistRows.length === 0) {
            return res.json({ success: false, message: "Playlist not found for this user" });
        }
        const playlistID = playlistRows[0].Playlist_ID;

        //Get total duration in milliseconds
        const [durationRows] = await db.query(
            `SELECT SUM(n.Duration_MS) AS totalDuration
             FROM playlist_songs ps
             JOIN newsong n ON ps.Song_ID = n.songID
             WHERE ps.Playlist_ID = ?`,
            [playlistID]
        );
        //convert totalduration to minutes and seconds
        const totalMs = durationRows[0].totalDuration || 0;
        const totalSec = Math.floor(totalMs / 1000);
        const minutes = Math.floor(totalSec / 60);
        const seconds = totalSec % 60;

        return res.json({
            success: true,
            playlist: playlistName,
            totalDuration: `${minutes} min ${seconds} sec`
        });

    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};
