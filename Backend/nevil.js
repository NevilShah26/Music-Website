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
            SELECT songID, songName, ArtistName, AlbumReleaseDate
            FROM newsong 
            JOIN artists  ON newsong.ArtistID = artists.ArtistID
            WHERE artistID IN (
                SELECT DISTINCT artistID
                FROM playlist 
                JOIN playlist_songs  ON playlist.Playlist_ID = playlist_songs.Playlist_ID
                JOIN newsong  ON playlist_songs.Song_ID = newsong.songID
                WHERE User_ID = ?
            )
            AND songID NOT IN (
                SELECT Song_ID
                FROM playlist 
                JOIN playlist_songs  ON playlist.Playlist_ID = playlist_songs.Playlist_ID
                WHERE playlist.User_ID = ?
            )
            ORDER BY newsong.Album_Release_Date DESC
            LIMIT 10;
            `,
            [userId, userId]
        );

        return res.json({ success: true, recommendations: recommendedSongs });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

