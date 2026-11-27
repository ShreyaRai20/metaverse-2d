import Arena from "@/components/arena/Arena";
import { Suspense } from "react";


export const instant = false;

export default async function SpacePage({ params }: { params: Promise<{ spaceId: string }> }) {
    const { spaceId } = await params;
    // key: opening a different space starts with a clean slate
    return <Arena key={spaceId} spaceId={spaceId} />;
}