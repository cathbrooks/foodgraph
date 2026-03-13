import { StateGraph, END } from "@langchain/langgraph";
import { RecommendationAnnotation, type RecommendationState } from "./state";
import { interpretIntent } from "./nodes/interpretIntent";
import { resolveContext } from "./nodes/resolveContext";
import { fetchRestaurants } from "./nodes/fetchRestaurants";
import { filterAndScore } from "./nodes/filterAndScore";
import { selectWildcard } from "./nodes/selectWildcard";
import { generateExplanations } from "./nodes/generateExplanations";
import { trackAndRespond } from "./nodes/trackAndRespond";
import { handleFollowup } from "./nodes/handleFollowup";
import { lookupRestaurantDetails } from "./nodes/lookupRestaurantDetails";
import { earlyExit } from "./nodes/earlyExit";
import { afterInterpretIntent, shouldEarlyExit, afterFilterAndScore } from "./edges/conditionals";

type NodeFn = (
  state: RecommendationState
) => Promise<Partial<RecommendationState>>;

function withErrorBoundary(name: string, fn: NodeFn): NodeFn {
  return async (state) => {
    const start = Date.now();
    try {
      const result = await fn(state);
      return {
        ...result,
        timings: { ...state.timings, [name]: Date.now() - start },
      };
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e1907f'},body:JSON.stringify({sessionId:'e1907f',location:'recommendationGraph.ts:errorBoundary',message:`withErrorBoundary caught error in ${name}`,data:{nodeName:name,error:String(err),stack:(err as Error)?.stack},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      console.error(`Node "${name}" failed:`, err);
      return {
        earlyExitReason: "INTERNAL_ERROR",
        timings: { ...state.timings, [name]: Date.now() - start },
      };
    }
  };
}

function buildGraph() {
  const graph = new StateGraph(RecommendationAnnotation)
    .addNode("interpretIntent", withErrorBoundary("interpretIntent", interpretIntent))
    .addNode("resolveContext", withErrorBoundary("resolveContext", resolveContext))
    .addNode("fetchRestaurants", withErrorBoundary("fetchRestaurants", fetchRestaurants))
    .addNode("filterAndScore", withErrorBoundary("filterAndScore", filterAndScore))
    .addNode("selectWildcard", withErrorBoundary("selectWildcard", selectWildcard))
    .addNode("generateExplanations", withErrorBoundary("generateExplanations", generateExplanations))
    .addNode("trackAndRespond", withErrorBoundary("trackAndRespond", trackAndRespond))
    .addNode("handleFollowup", withErrorBoundary("handleFollowup", handleFollowup))
    .addNode("lookupRestaurantDetails", withErrorBoundary("lookupRestaurantDetails", lookupRestaurantDetails))
    .addNode("earlyExit", withErrorBoundary("earlyExit", earlyExit));

  graph.addEdge("__start__", "interpretIntent");

  graph.addConditionalEdges("interpretIntent", afterInterpretIntent, {
    earlyExit: "earlyExit",
    handleFollowup: "handleFollowup",
    lookupRestaurantDetails: "lookupRestaurantDetails",
    resolveContext: "resolveContext",
  });

  graph.addConditionalEdges("resolveContext", shouldEarlyExit, {
    earlyExit: "earlyExit",
    continue: "fetchRestaurants",
  });

  graph.addConditionalEdges("fetchRestaurants", shouldEarlyExit, {
    earlyExit: "earlyExit",
    continue: "filterAndScore",
  });

  graph.addConditionalEdges("filterAndScore", afterFilterAndScore, {
    earlyExit: "earlyExit",
    selectWildcard: "selectWildcard",
    generateExplanations: "generateExplanations",
  });

  graph.addEdge("selectWildcard", "generateExplanations");
  graph.addEdge("generateExplanations", "trackAndRespond");
  graph.addEdge("trackAndRespond", END);
  graph.addEdge("lookupRestaurantDetails", "handleFollowup");
  graph.addEdge("handleFollowup", END);
  graph.addEdge("earlyExit", END);

  return graph.compile();
}

export const recommendationGraph = buildGraph();
