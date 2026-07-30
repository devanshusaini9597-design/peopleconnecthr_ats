import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Mail } from 'lucide-react';

const SubscribeThankYouPage = () => {
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');
  const errorMsg = error === 'invalid' ? 'Invalid email.' : error === 'invalid_link' ? 'Invalid or expired link. Please use the latest link from our email.' : error === 'unavailable' ? 'Subscription service is temporarily unavailable.' : error === 'failed' ? 'Subscription failed. Please try again.' : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden text-center">
          <div className="p-8">
            {errorMsg ? (
              <>
                <p className="text-red-600 text-sm font-medium mb-4">{errorMsg}</p>
                <Link to="/subscribe" className="text-indigo-600 hover:text-indigo-800 font-medium text-sm">Try subscribing again</Link>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <CheckCircle className="w-9 h-9 text-green-600" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-3">You have been successfully added to our mailing list.</h1>
                <p className="text-gray-600 text-sm leading-relaxed max-w-sm mx-auto">
                  You will receive job alerts, hiring updates, and insights from Skillnix Recruitment Services.
                </p>
                <p className="text-gray-500 text-sm mt-5">
                  You can <Link to="/unsubscribe" className="text-indigo-600 hover:text-indigo-800 font-medium underline underline-offset-2">unsubscribe here</Link> at any time.
                </p>
              </>
            )}
          </div>
          {!errorMsg && (
          <div className="px-6 pb-8 pt-2 border-t border-gray-100">
            <Link
              to="/subscribe"
              className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium text-sm"
            >
              <Mail className="w-4 h-4" /> Subscribe another email
            </Link>
            <span className="text-gray-300 mx-2">|</span>
            <Link to="/" className="text-gray-500 hover:text-indigo-600 font-medium text-sm">
              Back to home
            </Link>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscribeThankYouPage;
