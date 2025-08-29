import React, { useState, useEffect } from 'react';
import { X, Plus, List, Edit, Trash2, Save, GamepadIcon } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { databaseService } from '../services/databaseService';
import { Database } from '../lib/database.types';
import {
  GlassModal,
  GlassModalContent,
  GlassButton,
  GlassInput,
  FlexContainer,
  LoadingSpinner
} from '../styles/glass';

type GameList = Database['public']['Tables']['game_lists']['Row'];

interface GameListsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NewListForm {
  name: string;
  description: string;
}

export const GameListsModal: React.FC<GameListsModalProps> = ({ isOpen, onClose }) => {
  const { user } = useUser();
  const [gameLists, setGameLists] = useState<GameList[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingList, setEditingList] = useState<string | null>(null);
  const [newList, setNewList] = useState<NewListForm>({ name: '', description: '' });

  const loadGameLists = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const lists = await databaseService.gameLists.getUserGameLists(user.id);
      setGameLists(lists);
    } catch (err) {
      console.error('Error loading game lists:', err);
      setError('Failed to load game lists');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user?.id) {
      loadGameLists();
    }
  }, [isOpen, user?.id]);

  const handleCreateList = async () => {
    if (!user?.id || !newList.name.trim()) return;

    try {
      const created = await databaseService.gameLists.createGameList({
        user_id: user.id,
        name: newList.name.trim(),
        description: newList.description.trim() || null,
        game_codes: [],
      });

      if (created) {
        setGameLists([created, ...gameLists]);
        setNewList({ name: '', description: '' });
        setShowCreateForm(false);
      }
    } catch (err) {
      console.error('Error creating game list:', err);
      setError('Failed to create game list');
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!window.confirm('Are you sure you want to delete this game list?')) return;

    try {
      const success = await databaseService.gameLists.deleteGameList(listId);
      if (success) {
        setGameLists(gameLists.filter(list => list.id !== listId));
      }
    } catch (err) {
      console.error('Error deleting game list:', err);
      setError('Failed to delete game list');
    }
  };

  const handleUpdateList = async (listId: string, updates: { name?: string; description?: string }) => {
    try {
      const updated = await databaseService.gameLists.updateGameList(listId, updates);
      if (updated) {
        setGameLists(gameLists.map(list => 
          list.id === listId ? updated : list
        ));
        setEditingList(null);
      }
    } catch (err) {
      console.error('Error updating game list:', err);
      setError('Failed to update game list');
    }
  };

  const handleClose = () => {
    setShowCreateForm(false);
    setEditingList(null);
    setNewList({ name: '', description: '' });
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <GlassModal>
      <GlassModalContent style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}>
        <FlexContainer justify="space-between" align="center" style={{ marginBottom: '1.5rem' }}>
          <FlexContainer align="center" gap="0.5rem">
            <List size={24} style={{ color: 'rgba(139, 92, 246, 0.9)' }} />
            <h2 style={{ 
              margin: 0, 
              fontSize: '1.5rem', 
              color: 'rgba(255, 255, 255, 0.9)',
              fontWeight: '600'
            }}>
              My Game Lists
            </h2>
          </FlexContainer>
          <GlassButton 
            onClick={handleClose}
            style={{ 
              padding: '0.5rem',
              minWidth: 'auto',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }}
          >
            <X size={18} />
          </GlassButton>
        </FlexContainer>

        {error && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.3)', 
            padding: '0.75rem', 
            borderRadius: '8px', 
            marginBottom: '1rem',
            color: 'rgba(239, 68, 68, 0.9)'
          }}>
            {error}
          </div>
        )}

        <FlexContainer justify="space-between" align="center" style={{ marginBottom: '1rem' }}>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)', margin: 0 }}>
            Create custom lists to organize your favorite games
          </p>
          <GlassButton 
            onClick={() => setShowCreateForm(true)}
            style={{ 
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)'
            }}
          >
            <Plus size={16} style={{ marginRight: '0.5rem' }} />
            New List
          </GlassButton>
        </FlexContainer>

        {showCreateForm && (
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.05)', 
            border: '1px solid rgba(255, 255, 255, 0.1)', 
            borderRadius: '8px', 
            padding: '1rem', 
            marginBottom: '1rem' 
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'rgba(255, 255, 255, 0.9)' }}>Create New Game List</h3>
            
            <GlassInput
              placeholder="List name (required)"
              value={newList.name}
              onChange={(e) => setNewList({ ...newList, name: e.target.value })}
              style={{ marginBottom: '0.75rem' }}
            />
            
            <GlassInput
              placeholder="Description (optional)"
              value={newList.description}
              onChange={(e) => setNewList({ ...newList, description: e.target.value })}
              style={{ marginBottom: '1rem' }}
            />
            
            <FlexContainer gap="0.75rem" justify="flex-end">
              <GlassButton 
                onClick={() => {
                  setShowCreateForm(false);
                  setNewList({ name: '', description: '' });
                }}
                style={{ 
                  background: 'rgba(107, 114, 128, 0.2)',
                  border: '1px solid rgba(107, 114, 128, 0.3)'
                }}
              >
                Cancel
              </GlassButton>
              <GlassButton 
                onClick={handleCreateList}
                disabled={!newList.name.trim()}
                style={{ 
                  background: 'rgba(34, 197, 94, 0.2)',
                  border: '1px solid rgba(34, 197, 94, 0.4)'
                }}
              >
                <Save size={16} style={{ marginRight: '0.5rem' }} />
                Create List
              </GlassButton>
            </FlexContainer>
          </div>
        )}

        {loading ? (
          <FlexContainer justify="center" align="center" style={{ padding: '2rem' }}>
            <LoadingSpinner size="2rem" />
            <span style={{ marginLeft: '1rem', color: 'rgba(255, 255, 255, 0.7)' }}>
              Loading game lists...
            </span>
          </FlexContainer>
        ) : gameLists.length === 0 ? (
          <FlexContainer 
            direction="column" 
            align="center" 
            justify="center" 
            style={{ padding: '3rem', textAlign: 'center' }}
          >
            <GamepadIcon size={48} style={{ color: 'rgba(255, 255, 255, 0.3)', marginBottom: '1rem' }} />
            <h3 style={{ color: 'rgba(255, 255, 255, 0.7)', margin: '0 0 0.5rem 0' }}>
              No Game Lists Yet
            </h3>
            <p style={{ color: 'rgba(255, 255, 255, 0.5)', margin: 0 }}>
              Create your first list to start organizing games
            </p>
          </FlexContainer>
        ) : (
          <div>
            {gameLists.map((gameList) => (
              <div
                key={gameList.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '0.75rem',
                }}
              >
                {editingList === gameList.id ? (
                  <EditListForm
                    gameList={gameList}
                    onSave={(updates) => handleUpdateList(gameList.id, updates)}
                    onCancel={() => setEditingList(null)}
                  />
                ) : (
                  <FlexContainer justify="space-between" align="flex-start">
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', color: 'rgba(255, 255, 255, 0.9)' }}>
                        {gameList.name}
                      </h4>
                      {gameList.description && (
                        <p style={{ margin: '0 0 0.5rem 0', color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem' }}>
                          {gameList.description}
                        </p>
                      )}
                      <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.8rem' }}>
                        {Array.isArray(gameList.game_codes) ? gameList.game_codes.length : 0} games
                      </p>
                    </div>
                    <FlexContainer gap="0.5rem">
                      <GlassButton
                        onClick={() => setEditingList(gameList.id)}
                        style={{
                          padding: '0.5rem',
                          minWidth: 'auto',
                          background: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                        }}
                      >
                        <Edit size={16} />
                      </GlassButton>
                      <GlassButton
                        onClick={() => handleDeleteList(gameList.id)}
                        style={{
                          padding: '0.5rem',
                          minWidth: 'auto',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                        }}
                      >
                        <Trash2 size={16} />
                      </GlassButton>
                    </FlexContainer>
                  </FlexContainer>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassModalContent>
    </GlassModal>
  );
};

interface EditListFormProps {
  gameList: GameList;
  onSave: (updates: { name: string; description: string }) => void;
  onCancel: () => void;
}

const EditListForm: React.FC<EditListFormProps> = ({ gameList, onSave, onCancel }) => {
  const [name, setName] = useState(gameList.name);
  const [description, setDescription] = useState(gameList.description || '');

  const handleSave = () => {
    if (name.trim()) {
      onSave({
        name: name.trim(),
        description: description.trim(),
      });
    }
  };

  return (
    <div>
      <GlassInput
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ marginBottom: '0.75rem' }}
        placeholder="List name"
      />
      <GlassInput
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ marginBottom: '1rem' }}
        placeholder="Description (optional)"
      />
      <FlexContainer gap="0.75rem" justify="flex-end">
        <GlassButton
          onClick={onCancel}
          style={{
            background: 'rgba(107, 114, 128, 0.2)',
            border: '1px solid rgba(107, 114, 128, 0.3)',
          }}
        >
          Cancel
        </GlassButton>
        <GlassButton
          onClick={handleSave}
          disabled={!name.trim()}
          style={{
            background: 'rgba(34, 197, 94, 0.2)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
          }}
        >
          <Save size={16} style={{ marginRight: '0.5rem' }} />
          Save
        </GlassButton>
      </FlexContainer>
    </div>
  );
};