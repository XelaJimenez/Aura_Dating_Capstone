import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Signup from "./pages/Signup";
import Profile from "./pages/Profile";
import Questionnaire from "./pages/Questionnaire";
import Matching from "./pages/Matching";
import Chat from "./pages/Chat";
import DatePlanner from "./pages/DatePlanner";
import PostDateSurvey from "./components/PostDateSurvey";
import Preferences from "./pages/Preferences";
import Notifications from "./pages/Notifications";
import Appeal from "./pages/Appeal";
import AuraPlus from "./pages/AuraPlus";
import UserAvailability from "./pages/UserAvailability";

function App() {
    return (
        <Routes>
            <Route path="/"             element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/signup"       element={<Signup />} />
            <Route path="/preferences"  element={<Preferences />} />
            <Route path="/profile"      element={<Profile />} />
            <Route path="/aura-plus"    element={<AuraPlus />} />
            <Route path="/questionnaire" element={<Questionnaire />} />
            <Route path="/matching"     element={<Matching />} />
            <Route path="/chat"         element={<Chat />} />
            <Route path="/dates"        element={<DatePlanner />} />
            <Route path="/postDate"     element={<PostDateSurvey />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/appeals" element={<Appeal />} />
            <Route path="/availability"  element={<UserAvailability />} />
        </Routes>
    );
}

export default App;