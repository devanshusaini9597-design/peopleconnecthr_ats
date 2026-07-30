import React, { useRef, useEffect } from 'react';
import Layout from './Layout';
import ATS from './ATS';

const ATSPage = () => {
  const atsRef = useRef(null);

  const sidebarActions = {
    onAutoImport: () => {
      console.log('🎯 ATSPage.onAutoImport called');
      console.log('👉 atsRef.current:', atsRef.current);
      atsRef.current?.triggerAutoImport?.();
    },
    onAddCandidate: () => {
      console.log('🎯 ATSPage.onAddCandidate called');
      console.log('👉 atsRef.current:', atsRef.current);
      atsRef.current?.openAddCandidateModal?.();
    },
  };

  useEffect(() => {
    console.log('📍 ATSPage mounted');
    console.log('📍 sidebarActions:', sidebarActions);
  }, []);

  return (
    <Layout sidebarActions={sidebarActions}>
      <div className="w-full">
        <ATS ref={atsRef} />
      </div>
    </Layout>
  );
};

export default ATSPage;
