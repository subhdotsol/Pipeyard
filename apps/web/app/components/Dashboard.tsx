"use client";
/**
 * Dashboard - Job Queue Management with shadcn/ui
 */
import { useState, useEffect, FormEvent } from "react";
import { useJobUpdates } from "@/app/hooks/useJobUpdates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface Job {
    id: string;
    tenantId: string;
    type: string;
    payload: Record<string, unknown>;
    status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
    attempts: number;
    error: string | null;
    createdAt: string;
    updatedAt: string;
}

const API_URL = "http://localhost:3000";
const TENANT_ID = "tenant-1";

const statusVariants = {
    PENDING: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    RUNNING: "bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse",
    COMPLETED: "bg-green-500/20 text-green-400 border-green-500/30",
    FAILED: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function Dashboard() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [jobType, setJobType] = useState<string>("sleep");
    const { updates, isConnected } = useJobUpdates(TENANT_ID);

    useEffect(() => {
        fetchJobs();
    }, []);

    useEffect(() => {
        const latestUpdate = updates[0];
        if (latestUpdate) {
            setJobs((prev) =>
                prev.map((job) =>
                    job.id === latestUpdate.jobId
                        ? { ...job, status: latestUpdate.status, error: latestUpdate.error }
                        : job
                )
            );
        }
    }, [updates]);

    async function fetchJobs() {
        try {
            const res = await fetch(`${API_URL}/jobs?tenantId=${TENANT_ID}`);
            const data = await res.json();
            setJobs(data.jobs || []);
        } catch (error) {
            console.error("Failed to fetch jobs:", error);
        } finally {
            setLoading(false);
        }
    }

    async function createJob(e: FormEvent) {
        e.preventDefault();
        setCreating(true);

        const payloads: Record<string, Record<string, unknown>> = {
            sleep: { delayMs: 3000 },
            email: { to: "user@example.com", subject: "Test Email" },
            webhook: { url: "https://httpbin.org/post", method: "POST" },
        };

        try {
            const res = await fetch(`${API_URL}/jobs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tenantId: TENANT_ID,
                    type: jobType,
                    payload: payloads[jobType] || {},
                }),
            });
            const data = await res.json();
            console.log("Created job:", data.jobId);
            fetchJobs();
        } catch (error) {
            console.error("Failed to create job:", error);
        } finally {
            setCreating(false);
        }
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            📋 Job Queue Dashboard
                        </h1>
                        <p className="text-zinc-500 mt-1">Real-time job processing monitor</p>
                    </div>
                    <Badge
                        variant="outline"
                        className={isConnected ? "border-green-500 text-green-400" : "border-red-500 text-red-400"}
                    >
                        {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
                    </Badge>
                </div>

                {/* Create Job */}
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader>
                        <CardTitle>Create New Job</CardTitle>
                        <CardDescription>Add a new job to the processing queue</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={createJob} className="flex gap-4">
                            <Select value={jobType} onValueChange={setJobType}>
                                <SelectTrigger className="w-[200px] bg-zinc-800 border-zinc-700">
                                    <SelectValue placeholder="Select job type" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-800 border-zinc-700">
                                    <SelectItem value="sleep">Sleep (3s)</SelectItem>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="webhook">Webhook</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                type="submit"
                                disabled={creating}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500"
                            >
                                {creating ? "Creating..." : "Create Job"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Job List */}
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Jobs ({jobs.length})</CardTitle>
                            <CardDescription>All jobs for {TENANT_ID}</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchJobs} className="border-zinc-700">
                            🔄 Refresh
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <p className="text-zinc-500 text-center py-8">Loading...</p>
                        ) : jobs.length === 0 ? (
                            <p className="text-zinc-500 text-center py-8">No jobs yet. Create one above!</p>
                        ) : (
                            <div className="space-y-3">
                                {jobs.map((job) => (
                                    <div
                                        key={job.id}
                                        className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-3">
                                                <span className="font-medium capitalize">{job.type}</span>
                                                <Badge className={statusVariants[job.status]}>{job.status}</Badge>
                                            </div>
                                            <div className="text-sm text-zinc-500 font-mono">
                                                {job.id.slice(0, 8)}... • Attempts: {job.attempts}
                                            </div>
                                            {job.error && (
                                                <div className="text-sm text-red-400">{job.error}</div>
                                            )}
                                        </div>
                                        <div className="text-sm text-zinc-500">
                                            {new Date(job.createdAt).toLocaleTimeString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Real-time Updates */}
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader>
                        <CardTitle>Real-time Updates</CardTitle>
                        <CardDescription>Live status changes from WebSocket</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {updates.length === 0 ? (
                            <p className="text-zinc-500 text-center py-4">Waiting for updates...</p>
                        ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {updates.slice(0, 10).map((update, i) => (
                                    <div key={i} className="flex items-center gap-3 text-sm">
                                        <Badge className={statusVariants[update.status]}>{update.status}</Badge>
                                        <span className="font-mono text-zinc-400">{update.jobId.slice(0, 8)}...</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
