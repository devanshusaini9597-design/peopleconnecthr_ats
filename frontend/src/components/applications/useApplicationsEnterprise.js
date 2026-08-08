import API_URL from '../../config';
import { authenticatedFetch } from '../../utils/fetchUtils';

export function useApplicationsEnterprise({ showToast, setSelectedApp, setEnterpriseActionLoading }) {
  const orderBackgroundCheck = async (appId) => {
    setEnterpriseActionLoading(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/api/background-check/applications/${appId}/order`, {
        method: 'POST',
        body: JSON.stringify({ provider: 'checkr' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to order background check');
      showToast('Background check ordered');
      setSelectedApp((prev) => (prev ? { ...prev, backgroundCheck: { status: 'pending', provider: 'checkr' } } : prev));
    } catch (err) {
      showToast(err.message || 'Failed to order background check', 'error');
    } finally {
      setEnterpriseActionLoading(false);
    }
  };

  const sendForEsign = async (appId) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setEnterpriseActionLoading(true);
      try {
        const documentBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const res = await authenticatedFetch(`${API_URL}/api/esign/applications/${appId}/send`, {
          method: 'POST',
          body: JSON.stringify({ provider: 'docusign', documentBase64, documentName: file.name }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to send for e-signature');
        showToast('Offer letter sent for e-signature');
        setSelectedApp((prev) => (prev ? { ...prev, esign: { status: 'sent', provider: 'docusign' } } : prev));
      } catch (err) {
        showToast(err.message || 'Failed to send for e-signature', 'error');
      } finally {
        setEnterpriseActionLoading(false);
      }
    };
    input.click();
  };

  return { orderBackgroundCheck, sendForEsign };
}
