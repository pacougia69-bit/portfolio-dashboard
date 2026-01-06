import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle } from "lucide-react";

export default function DebugPage() {
  const { data, isLoading, error } = trpc.debug.checkUrl.useQuery();

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">🔍 Railway Deployment Debug</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Environment Variables Check</CardTitle>
          <CardDescription>
            This page shows which environment variables are set on Railway
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="text-gray-500">Loading...</div>
          )}

          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Error: {error.message}
              </AlertDescription>
            </Alert>
          )}

          {data && (
            <div className="space-y-4">
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 font-semibold">
                  {data.deploymentCheck}
                </AlertDescription>
              </Alert>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-3">Deployment Info:</h3>
                <p className="text-sm text-gray-600 mb-2">{data.message}</p>
                <p className="text-xs text-gray-500">Timestamp: {data.timestamp}</p>
              </div>

              <div className="bg-white border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Environment Variables:</h3>
                <div className="space-y-2">
                  {Object.entries(data.environment).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center py-2 border-b last:border-0">
                      <span className="font-mono text-sm font-semibold">{key}</span>
                      <span className={`font-mono text-sm ${value === '(not set)' ? 'text-red-500' : 'text-green-600'}`}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <h3 className="font-semibold mb-2 text-yellow-800">Expected Configuration:</h3>
                <p className="text-sm text-yellow-700">
                  For media uploads to work, at least one of these must be set:
                </p>
                <ul className="list-disc list-inside text-sm text-yellow-700 mt-2 space-y-1">
                  <li><code className="bg-yellow-100 px-1 rounded">PUBLIC_URL</code></li>
                  <li><code className="bg-yellow-100 px-1 rounded">RAILWAY_STATIC_URL</code></li>
                  <li><code className="bg-yellow-100 px-1 rounded">RAILWAY_PUBLIC_DOMAIN</code></li>
                  <li><code className="bg-yellow-100 px-1 rounded">OAUTH_SERVER_URL</code></li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-sm text-gray-500">
        <p>💡 Tip: If you see an old deployment check or wrong environment variables,
        Railway hasn't deployed the new code yet. Wait for the deployment to complete.</p>
      </div>
    </div>
  );
}
