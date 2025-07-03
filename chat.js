import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';

// Firebase configuration and app ID are provided by the environment
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Main App component
const App = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState(null);
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false); // To track if auth state is ready
  const messagesEndRef = useRef(null); // Ref for auto-scrolling to the latest message

  // Initialize Firebase and set up authentication listener
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const firestoreDb = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestoreDb);
      setAuth(firebaseAuth);

      // Sign in anonymously or with custom token
      const signIn = async () => {
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(firebaseAuth, initialAuthToken);
          } else {
            await signInAnonymously(firebaseAuth);
          }
        } catch (error) {
          console.error("Firebase authentication error:", error);
        }
      };

      // Listen for auth state changes
      const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (currentUser) => {
        setUser(currentUser);
        setIsAuthReady(true); // Mark auth as ready once the initial check is done
      });

      signIn(); // Call sign-in function

      return () => unsubscribeAuth(); // Cleanup auth listener on unmount
    } catch (error) {
      console.error("Failed to initialize Firebase:", error);
    }
  }, []);

  // Listen for real-time messages from Firestore
  useEffect(() => {
    if (db && user && isAuthReady) {
      // Determine the collection path based on whether the user is authenticated
      // For a public chat, we use a public collection.
      // For private data, the path would be `/artifacts/${appId}/users/${user.uid}/messages`
      const messagesCollectionRef = collection(db, `artifacts/${appId}/public/data/messages`);
      const q = query(messagesCollectionRef, orderBy('timestamp', 'asc')); // Order by timestamp

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedMessages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMessages(fetchedMessages);
      }, (error) => {
        console.error("Error fetching messages:", error);
      });

      return () => unsubscribe(); // Cleanup snapshot listener on unmount
    }
  }, [db, user, isAuthReady]); // Re-run when db, user, or auth readiness changes

  // Scroll to the latest message whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle sending a new message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !db || !user) return;

    try {
      await addDoc(collection(db, `artifacts/${appId}/public/data/messages`), {
        text: newMessage,
        userId: user.uid, // Store the user ID
        timestamp: serverTimestamp(), // Firestore server timestamp
      });
      setNewMessage(''); // Clear the input field
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Display a loading message if auth is not ready
  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading chat...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="bg-white shadow-lg rounded-xl p-6 w-full max-w-md flex flex-col h-[80vh]">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          Real-time Chat
        </h1>

        {/* Display current user ID */}
        <div className="text-sm text-gray-600 mb-4 text-center">
          Your User ID: <span className="font-semibold text-blue-600">{user?.uid || 'N/A'}</span>
        </div>

        {/* Message display area */}
        <div className="flex-grow overflow-y-auto border border-gray-200 rounded-lg p-4 mb-4 space-y-3 bg-gray-50">
          {messages.length === 0 ? (
            <p className="text-center text-gray-500">No messages yet. Start chatting!</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.userId === user?.uid ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] p-3 rounded-xl shadow-sm ${
                    msg.userId === user?.uid
                      ? 'bg-blue-500 text-white rounded-br-none'
                      : 'bg-gray-300 text-gray-800 rounded-bl-none'
                  }`}
                >
                  <p className="text-sm">{msg.text}</p>
                  <span className="block text-xs mt-1 opacity-75">
                    {msg.userId === user?.uid ? 'You' : `User: ${msg.userId.substring(0, 8)}...`}
                    {msg.timestamp && ` - ${new Date(msg.timestamp.toDate()).toLocaleTimeString()}`}
                  </span>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} /> {/* Empty div for scrolling */}
        </div>

        {/* Message input form */}
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-grow p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-200 ease-in-out transform hover:scale-105"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default App;
