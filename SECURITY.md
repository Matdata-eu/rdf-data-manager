# Security

The app runs entirely in the browser and sends SPARQL queries and updates to the endpoint
the user configures. It has no accounts, stores no credentials, and relies on the
endpoint (or a proxy in front of it) for authentication and authorisation.

If you find a problem that lets a page, a shapes file or a data value do something the user
did not ask for (for example running an update the form did not show), please report it
privately through GitHub's [private vulnerability reporting](https://github.com/Matdata-eu/rdf-data-manager/security/advisories/new)
rather than opening a public issue. We aim to answer within a week.

Supported: the latest release and `main`.
