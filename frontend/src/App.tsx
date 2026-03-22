import { useState, useEffect } from 'react';
import type { ChoiceList } from './services/api';
import apiClient from './services/api';
import './App.css';

function App() {
  const [choiceLists, setChoiceLists] = useState<ChoiceList[]>([]);
  const [selectedList, setSelectedList] = useState<ChoiceList | null>(null);
  const [loading, setLoading] = useState(false);
  const [newChoiceLabel, setNewChoiceLabel] = useState('');

  // Fetch all choice lists on mount
  useEffect(() => {
    fetchChoiceLists();
  }, []);

  const fetchChoiceLists = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getChoiceLists();
      // DRF returns paginated data with results key
      const lists = Array.isArray(response.data) ? response.data : response.data.results || [];
      setChoiceLists(lists);
    } catch (error) {
      console.error('Failed to fetch choice lists:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChoiceList = async (id: number) => {
    try {
      const response = await apiClient.getChoiceList(id);
      setSelectedList(response.data);
    } catch (error) {
      console.error('Failed to fetch choice list:', error);
    }
  };

  const handleSelectList = (list: ChoiceList) => {
    fetchChoiceList(list.id);
  };

  const handleAddChoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedList || !newChoiceLabel.trim()) return;

    try {
      const newChoice = await apiClient.createChoice(selectedList.id, {
        label: newChoiceLabel,
      });

      // Update local state
      const updatedList = { ...selectedList };
      if (!updatedList.choices) updatedList.choices = [];
      updatedList.choices.push(newChoice.data);
      setSelectedList(updatedList);
      setNewChoiceLabel('');
    } catch (error) {
      console.error('Failed to add choice:', error);
    }
  };

  const handleDeleteChoice = async (choiceId: number) => {
    if (!selectedList) return;

    try {
      await apiClient.deleteChoice(choiceId);

      // Update local state
      const updatedList = { ...selectedList };
      updatedList.choices = (updatedList.choices || []).filter(
        (c) => c.id !== choiceId
      );
      setSelectedList(updatedList);
    } catch (error) {
      console.error('Failed to delete choice:', error);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Choices Manager</h1>
        <p>Manage external choice lists for KoboToolbox</p>
      </header>

      <div className="app-container">
        <aside className="sidebar">
          <h2>Choice Lists</h2>
          {loading ? (
            <p>Loading...</p>
          ) : choiceLists.length === 0 ? (
            <p>No choice lists found</p>
          ) : (
            <ul>
              {choiceLists.map((list) => (
                <li key={list.id}>
                  <button
                    onClick={() => handleSelectList(list)}
                    className={selectedList?.id === list.id ? 'active' : ''}
                  >
                    {list.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="main-content">
          {selectedList ? (
            <>
              <div className="list-header">
                <h2>{selectedList.name}</h2>
                <p className="list-info">
                  Project: <code>{selectedList.project}</code> | Slug: <code>{selectedList.slug}</code>
                </p>
                {selectedList.description && (
                  <p className="description">{selectedList.description}</p>
                )}
              </div>

              <div className="choices-section">
                <h3>Choices ({selectedList.choices?.length || 0})</h3>

                <form onSubmit={handleAddChoice} className="add-choice-form">
                  <input
                    type="text"
                    placeholder="Enter choice label"
                    value={newChoiceLabel}
                    onChange={(e) => setNewChoiceLabel(e.target.value)}
                  />
                  <button type="submit">Add Choice</button>
                </form>

                {selectedList.choices && selectedList.choices.length > 0 ? (
                  <table className="choices-table">
                    <thead>
                      <tr>
                        <th>Label</th>
                        <th>Value</th>
                        <th>Order</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedList.choices.map((choice) => (
                        <tr key={choice.id}>
                          <td>{choice.label}</td>
                          <td>
                            <code>{choice.value}</code>
                          </td>
                          <td>{choice.order}</td>
                          <td>
                            <button
                              onClick={() => handleDeleteChoice(choice.id)}
                              className="delete-btn"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>No choices yet</p>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>Select a choice list to get started</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
