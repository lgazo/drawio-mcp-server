# Example Prompts

A collection of prompts for generating diagrams with the Draw.io MCP server.

---

## Azure Architecture — Front Door with Container Apps and App Service

> Please generate an Azure diagram that shows Front Door as the point of entry. Behind Front Door should be two container apps that are part of the same container apps environment. App 1 should be named "Web" and app 2 should be named "API". Both container apps receive their images from the same container registry name "my-registry". There should be also be a separate API named "API 2" running in an App Service, which should be placed behind the front door. Please also add proper non-functional components that cover cross-cutting concerns. 
