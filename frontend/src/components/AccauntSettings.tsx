
import React, { useState } from "react";
import "./AccountSettings.css";

type Tab = "profile" | "security" | "notifications";

export default function AccountSettings() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [message, setMessage] = useState("");

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    about: ""
  });

  const [password, setPassword] = useState({
    old: "",
    new: "",
    confirm: ""
  });

  const [notifications, setNotifications] = useState({
    email: true,
    courses: true,
    lessons: true,
    updates: false
  });

  const tabs = [
    { id: "profile" as Tab, icon: "♙", title: "Жеке маалымат" },
    { id: "security" as Tab, icon: "♢", title: "Коопсуздук" },
    { id: "notifications" as Tab, icon: "⚙", title: "Эскертүүлөр" }
  ];

  const saveProfile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    localStorage.setItem("levelup_profile", JSON.stringify(profile));
    setMessage("Маалыматтар ийгиликтүү сакталды!");
  };

  const changePassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (password.new.length < 8) {
      setMessage("Сырсөз кеминде 8 белгиден турушу керек.");
      return;
    }

    if (password.new !== password.confirm) {
      setMessage("Жаңы сырсөздөр дал келген жок!");
      return;
    }

    setMessage("Сырсөздү өзгөртүү үчүн серверге туташтыруу керек.");
  };

  const saveNotifications = () => {
    localStorage.setItem(
      "levelup_notifications",
      JSON.stringify(notifications)
    );
    setMessage("Эскертүүлөр сакталды!");
  };

  return (
    <div className="account-settings">

      <aside className="settings-sidebar">
        <div className="settings-heading">
          <span className="settings-heading-icon">⚙</span>
          <div>
            <h2>Аккаунт тууралоолору</h2>
            <p>Аккаунтуңузду башкарыңыз</p>
          </div>
        </div>

        <div className="settings-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`settings-tab ${
                activeTab === tab.id ? "active" : ""
              }`}
              onClick={() => {
                setActiveTab(tab.id);
                setMessage("");
              }}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span>{tab.title}</span>
              <span className="tab-arrow">›</span>
            </button>
          ))}
        </div>

        <div className="settings-sidebar-note">
          <span>🌱</span>
          <p>LevelUp менен билимиңизди өнүктүрүңүз!</p>
        </div>
      </aside>

      <main className="settings-content">

        {message && (
          <div className="settings-message">
            {message}
          </div>
        )}

        {activeTab === "profile" && (
          <section>
            <div className="content-heading">
              <span className="content-icon">♙</span>
              <div>
                <h2>Жеке маалымат</h2>
                <p>Профилиңиздеги маалыматтарды жаңыртыңыз.</p>
              </div>
            </div>

            <div className="profile-avatar">
              <div className="avatar-circle">👤</div>
              <div>
                <h3>Профиль маалыматы</h3>
                <p>Жеке маалыматтарыңызды толтуруңуз.</p>
              </div>
            </div>

            <form onSubmit={saveProfile}>
              <div className="settings-form-grid">
                <div className="form-group">
                  <label>Аты-жөнү</label>
                  <input
                    type="text"
                    placeholder="Аты-жөнүңүз"
                    value={profile.name}
                    onChange={(e) =>
                      setProfile({ ...profile, name: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Email дареги</label>
                  <input
                    type="email"
                    placeholder="example@gmail.com"
                    value={profile.email}
                    onChange={(e) =>
                      setProfile({ ...profile, email: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Телефон номери</label>
                  <input
                    type="tel"
                    placeholder="+996 700 000 000"
                    value={profile.phone}
                    onChange={(e) =>
                      setProfile({ ...profile, phone: e.target.value })
                    }
                  />
                </div>

                <div className="form-group full-width">
                  <label>Өзүңүз жөнүндө</label>
                  <textarea
                    placeholder="Өзүңүз жөнүндө кыскача жазыңыз..."
                    value={profile.about}
                    onChange={(e) =>
                      setProfile({ ...profile, about: e.target.value })
                    }
                  />
                </div>
              </div>

              <button type="submit" className="settings-save-btn">
                Маалыматты сактоо
              </button>
            </form>
          </section>
        )}

        {activeTab === "security" && (
          <section>
            <div className="content-heading">
              <span className="content-icon">♢</span>
              <div>
                <h2>Коопсуздук</h2>
                <p>Аккаунтуңуздун коопсуздугун башкарыңыз.</p>
              </div>
            </div>

            <div className="security-info">
              <span>🛡️</span>
              <div>
                <strong>Аккаунтуңузду коргоңуз</strong>
                <p>Башкаларга сырсөзүңүздү бербеңиз.</p>
              </div>
            </div>

            <form onSubmit={changePassword}>
              <div className="form-group">
                <label>Учурдагы сырсөз</label>
                <input
                  type="password"
                  required
                  value={password.old}
                  onChange={(e) =>
                    setPassword({ ...password, old: e.target.value })
                  }
                  placeholder="Учурдагы сырсөз"
                />
              </div>

              <div className="form-group">
                <label>Жаңы сырсөз</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password.new}
                  onChange={(e) =>
                    setPassword({ ...password, new: e.target.value })
                  }
                  placeholder="Кеминде 8 белги"
                />
              </div>

              <div className="form-group">
                <label>Жаңы сырсөздү кайталаңыз</label>
                <input
                  type="password"
                  required
                  value={password.confirm}
                  onChange={(e) =>
                    setPassword({ ...password, confirm: e.target.value })
                  }
                  placeholder="Сырсөздү кайталаңыз"
                />
              </div>

              <button type="submit" className="settings-save-btn">
                Сырсөздү өзгөртүү
              </button>
            </form>
          </section>
        )}

        {activeTab === "notifications" && (
          <section>
            <div className="content-heading">
              <span className="content-icon">⚙</span>
              <div>
                <h2>Эскертүүлөр</h2>
                <p>Өзүңүзгө керектүү билдирүүлөрдү тандаңыз.</p>
              </div>
            </div>

            <div className="notification-list">
              {[
                {
                  id: "email" as const,
                  title: "Email билдирүүлөрү",
                  description: "Маанилүү билдирүүлөрдү алуу"
                },
                {
                  id: "courses" as const,
                  title: "Жаңы курстар",
                  description: "Жаңы курстар жөнүндө маалымат"
                },
                {
                  id: "lessons" as const,
                  title: "Сабактар",
                  description: "Сабактар жана окуу процесси жөнүндө"
                },
                {
                  id: "updates" as const,
                  title: "Сайт жаңылыктары",
                  description: "LevelUp платформасындагы жаңылыктар"
                }
              ].map((item) => (
                <div className="notification-item" key={item.id}>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>

                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={notifications[item.id]}
                      onChange={(e) =>
                        setNotifications({
                          ...notifications,
                          [item.id]: e.target.checked
                        })
                      }
                    />
                    <span className="switch-slider"></span>
                  </label>
                </div>
              ))}
            </div>

            <button
              className="settings-save-btn"
              onClick={saveNotifications}
            >
              Өзгөртүүлөрдү сактоо
            </button>
          </section>
        )}

      </main>
    </div>
  );
}
