import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Link } from "react-router-dom";

const Login = () => {
  const [formData, setFormData] = useState({ username: "", password: "" });
  const { login, isLoggingIn } = useAuthStore();

  const handleSubmit = (e) => {
    e.preventDefault();
    login(formData);
  };

  return (
    <div className="h-screen w-full bg-wa-bg flex items-center justify-center">
      <div className="bg-wa-bg-panel p-8 rounded-lg w-full max-w-sm border border-wa-divider">
        <h2 className="text-2xl font-bold mb-6 text-center text-wa-accent">WhatsApp Login</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Username"
            className="bg-wa-bg-search p-3 rounded border border-wa-divider outline-none focus:border-wa-accent"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="bg-wa-bg-search p-3 rounded border border-wa-divider outline-none focus:border-wa-accent"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />
          <button
            type="submit"
            disabled={isLoggingIn}
            className="bg-wa-accent text-wa-bg p-3 rounded font-bold hover:bg-wa-accent-dark disabled:opacity-50"
          >
            {isLoggingIn ? "Logging in..." : "Login"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-wa-text-muted">
          Don't have an account? <Link to="/signup" className="text-wa-accent hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
