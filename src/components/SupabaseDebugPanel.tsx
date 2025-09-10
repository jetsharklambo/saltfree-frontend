import React, { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { BlockButton, BlockModal, BlockModalContent, blockTheme } from '../styles/blocks';
import { runSupabaseHealthCheck, testUsernameUpdate, getDatabaseInfo, SupabaseHealthCheck } from '../utils/supabaseDebug';
import styled from '@emotion/styled';
import { Database, RefreshCw, X, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const DebugPanel = styled.div`
  position: fixed;
  bottom: 2rem;
  left: 2rem;
  z-index: 9999;
`;

const DebugButton = styled(BlockButton)`
  background: ${blockTheme.pastelLavender};
  border: 3px solid ${blockTheme.darkText};
  padding: 0.75rem;
  
  &:hover {
    background: ${blockTheme.pastelPink};
  }
`;

const DebugContent = styled.div`
  max-height: 60vh;
  overflow-y: auto;
  padding: 1rem;
`;

const SectionTitle = styled.h4`
  color: ${blockTheme.darkText};
  margin: 1rem 0 0.5rem 0;
  font-size: 1.1rem;
  font-weight: 600;
`;

const StatusItem = styled.div<{ status: 'success' | 'error' | 'warning' }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  margin: 0.25rem 0;
  border-radius: 8px;
  font-size: 0.9rem;
  background: ${props => 
    props.status === 'success' ? blockTheme.pastelMint :
    props.status === 'error' ? blockTheme.pastelCoral :
    blockTheme.pastelYellow
  };
  
  svg {
    flex-shrink: 0;
  }
`;

const ErrorList = styled.ul`
  margin: 0.5rem 0;
  padding-left: 1.5rem;
  color: ${blockTheme.darkText};
  
  li {
    margin: 0.25rem 0;
    font-size: 0.85rem;
  }
`;

const TestResults = styled.div`
  background: ${blockTheme.pastelGray};
  border: 2px solid ${blockTheme.darkText};
  border-radius: 8px;
  padding: 1rem;
  margin: 1rem 0;
  font-family: monospace;
  font-size: 0.8rem;
  max-height: 200px;
  overflow-y: auto;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  margin: 1rem 0;
  flex-wrap: wrap;
`;

const SupabaseDebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [healthCheck, setHealthCheck] = useState<SupabaseHealthCheck | null>(null);
  const [dbInfo, setDbInfo] = useState<any>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const account = useActiveAccount();

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      const result = await runSupabaseHealthCheck(account?.address);
      setHealthCheck(result);
    } catch (error) {
      console.error('Health check failed:', error);
    }
    setLoading(false);
  };

  const getDatabaseDetails = async () => {
    setLoading(true);
    try {
      const info = await getDatabaseInfo();
      setDbInfo(info);
    } catch (error) {
      console.error('Database info failed:', error);
    }
    setLoading(false);
  };

  const testUsername = async () => {
    if (!account?.address) {
      alert('Connect wallet first');
      return;
    }

    setLoading(true);
    try {
      const result = await testUsernameUpdate(account.address, `test_${Date.now()}`);
      setTestResults(result);
    } catch (error) {
      console.error('Username test failed:', error);
    }
    setLoading(false);
  };

  const StatusIcon: React.FC<{ status: boolean }> = ({ status }) => {
    return status ? 
      <CheckCircle size={16} style={{ color: blockTheme.success }} /> :
      <XCircle size={16} style={{ color: blockTheme.error }} />;
  };

  return (
    <>
      <DebugPanel>
        <DebugButton onClick={() => setIsOpen(true)}>
          <Database size={20} />
        </DebugButton>
      </DebugPanel>

      {isOpen && (
        <BlockModal onClick={() => setIsOpen(false)}>
          <BlockModalContent onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: blockTheme.darkText }}>Supabase Debug Panel</h3>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: blockTheme.pastelCoral,
                  border: `3px solid ${blockTheme.darkText}`,
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <DebugContent>
              <ButtonGroup>
                <BlockButton onClick={runHealthCheck} disabled={loading}>
                  {loading ? <RefreshCw size={16} className="spinning" /> : 'Run Health Check'}
                </BlockButton>
                <BlockButton onClick={getDatabaseDetails} disabled={loading}>
                  Database Info
                </BlockButton>
                <BlockButton onClick={testUsername} disabled={loading || !account?.address}>
                  Test Username Update
                </BlockButton>
              </ButtonGroup>

              {healthCheck && (
                <>
                  <SectionTitle>Health Check Results</SectionTitle>
                  <StatusItem status={healthCheck.connection ? 'success' : 'error'}>
                    <StatusIcon status={healthCheck.connection} />
                    Connection: {healthCheck.connection ? 'OK' : 'Failed'}
                  </StatusItem>
                  <StatusItem status={healthCheck.authentication ? 'success' : 'error'}>
                    <StatusIcon status={healthCheck.authentication} />
                    Authentication: {healthCheck.authentication ? 'OK' : 'Failed'}
                  </StatusItem>
                  <StatusItem status={healthCheck.userTableAccess ? 'success' : 'error'}>
                    <StatusIcon status={healthCheck.userTableAccess} />
                    User Table Access: {healthCheck.userTableAccess ? 'OK' : 'Failed'}
                  </StatusItem>
                  <StatusItem status={healthCheck.userCreation ? 'success' : 'error'}>
                    <StatusIcon status={healthCheck.userCreation} />
                    User Creation: {healthCheck.userCreation ? 'OK' : 'Failed'}
                  </StatusItem>
                  <StatusItem status={healthCheck.userUpdate ? 'success' : 'error'}>
                    <StatusIcon status={healthCheck.userUpdate} />
                    User Update: {healthCheck.userUpdate ? 'OK' : 'Failed'}
                  </StatusItem>
                  
                  {healthCheck.errors.length > 0 && (
                    <>
                      <SectionTitle>Errors:</SectionTitle>
                      <ErrorList>
                        {healthCheck.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ErrorList>
                    </>
                  )}
                </>
              )}

              {dbInfo && (
                <>
                  <SectionTitle>Database Information</SectionTitle>
                  <TestResults>
                    <div>URL: {dbInfo.supabaseUrl}</div>
                    <div>Has Anon Key: {dbInfo.hasAnonymousKey ? 'Yes' : 'No'}</div>
                    <div>Connection Time: {dbInfo.connectionTime}ms</div>
                    <div>Accessible Tables: {dbInfo.tablesAccessible.join(', ') || 'None'}</div>
                  </TestResults>
                </>
              )}

              {testResults && (
                <>
                  <SectionTitle>Username Test Results</SectionTitle>
                  <StatusItem status={testResults.success ? 'success' : 'error'}>
                    <StatusIcon status={testResults.success} />
                    Test {testResults.success ? 'Passed' : 'Failed'}
                    {testResults.error && `: ${testResults.error}`}
                  </StatusItem>
                  <TestResults>
                    {testResults.steps.map((step: string, index: number) => (
                      <div key={index}>{step}</div>
                    ))}
                  </TestResults>
                </>
              )}

              {account?.address && (
                <>
                  <SectionTitle>Wallet Info</SectionTitle>
                  <div style={{ fontSize: '0.9rem', color: blockTheme.darkText }}>
                    Connected: {account.address}
                  </div>
                </>
              )}
            </DebugContent>
          </BlockModalContent>
        </BlockModal>
      )}
    </>
  );
};

export default SupabaseDebugPanel;