/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { ListSubheader } from '@/base/components/lists/ListSubheader.tsx';
import { useLingui } from '@lingui/react/macro';
import { plural } from '@lingui/core/macro';
import { TextSetting } from '@/base/components/settings/text/TextSetting.tsx';
import { SelectSetting } from '@/base/components/settings/SelectSetting.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { DownloadAheadSetting } from '@/features/downloads/components/DownloadAheadSetting.tsx';
import {
    createUpdateMetadataServerSettings,
    useMetadataServerSettings,
} from '@/features/settings/services/ServerSettingsMetadata.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { DeleteChaptersWhileReadingSetting } from '@/features/downloads/components/DeleteChaptersWhileReadingSetting.tsx';
import { CategoriesInclusionSetting } from '@/features/category/components/CategoriesInclusionSetting.tsx';
import { NumberSetting } from '@/base/components/settings/NumberSetting.tsx';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import type {
    GetCategoriesSettingsQuery,
    GetCategoriesSettingsQueryVariables,
} from '@/lib/graphql/generated/graphql.ts';
import { GET_CATEGORIES_SETTINGS } from '@/lib/graphql/category/CategoryQuery.ts';
import type { MetadataDownloadSettings } from '@/features/downloads/Downloads.types.ts';
import type { ServerSettings } from '@/features/settings/Settings.types.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';
import { ListItemLink } from '@/base/components/lists/ListItemLink.tsx';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { DownloadStorageType } from '@/lib/graphql/generated/graphql-base.types.ts';
import { DOWNLOAD_STORAGE_TYPE_SELECT_VALUES } from '@/features/settings/Settings.constants.ts';
type DownloadSettingsType = Pick<
    ServerSettings,
    | 'downloadStorageType'
    | 'webdavUrl'
    | 'webdavUsername'
    | 'webdavPassword'
    | 'webdavRemotePath'
    | 'downloadAsCbz'
    | 'downloadsPath'
    | 'autoDownloadNewChapters'
    | 'autoDownloadNewChaptersLimit'
    | 'excludeEntryWithUnreadChapters'
    | 'autoDownloadIgnoreReUploads'
    | 'downloadConversions'
>;

export const DownloadSettings = () => {
    const { t } = useLingui();

    useAppTitle(t`Downloads`);

    const categories = requestManager.useGetCategories<GetCategoriesSettingsQuery, GetCategoriesSettingsQueryVariables>(
        GET_CATEGORIES_SETTINGS,
    );
    const serverSettings = requestManager.useGetServerSettings();
    const [mutateSettings] = requestManager.useUpdateServerSettings();
    const {
        settings: metadataSettings,
        loading: areMetadataServerSettingsLoading,
        request: { error: metadataServerSettingsError, refetch: refetchMetadataServerSettings },
    } = useMetadataServerSettings();

    // Test connection state
    const [testConnection, { loading: testLoading, data: testResult, error: testError }] =
        requestManager.useTestWebDavConnection();

    const loading = serverSettings.loading || areMetadataServerSettingsLoading || categories.loading;
    if (loading) {
        return <LoadingPlaceholder />;
    }

    const error = serverSettings.error ?? metadataServerSettingsError ?? categories.error;
    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t`Unable to load data`}
                messageExtra={getErrorMessage(error)}
                retry={() => {
                    if (serverSettings.error) {
                        serverSettings
                            .refetch()
                            .catch(defaultPromiseErrorHandler('DownloadSettings::refetchServerSettings'));
                    }

                    if (metadataServerSettingsError) {
                        refetchMetadataServerSettings().catch(
                            defaultPromiseErrorHandler('refetchMetadataServerSettings::'),
                        );
                    }

                    if (categories.error) {
                        categories.refetch().catch(defaultPromiseErrorHandler('LibrarySettings::refetchCategories'));
                    }
                }}
            />
        );
    }

    const downloadSettings = serverSettings.data!.settings as DownloadSettingsType;

    const updateSetting = (setting: keyof DownloadSettingsType, value: any): Promise<any> => {
        const mutation = mutateSettings({ variables: { input: { settings: { [setting]: value } } } });
        mutation.catch((e) => makeToast(t`Failed to save changes`, 'error', getErrorMessage(e)));

        return mutation;
    };

    const updateMetadataSetting = createUpdateMetadataServerSettings<keyof MetadataDownloadSettings>((e) =>
        makeToast(t`Failed to save changes`, 'error', getErrorMessage(e)),
    );

    const storageType = downloadSettings.downloadStorageType ?? DownloadStorageType.Local;

    const handleTestConnection = () => {
        const url = downloadSettings.webdavUrl || '';
        const username = downloadSettings.webdavUsername || '';
        const password = downloadSettings.webdavPassword || '';

        testConnection({
            variables: { input: { url, username, password } },
        }).catch(() => {}); // errors handled via testError
    };

    const testStatus =
        testResult?.testWebDavConnection?.success === true
            ? 'success'
            : testResult?.testWebDavConnection?.success === false
              ? 'error'
              : null;
    const testMessage = testResult?.testWebDavConnection?.message ?? testError?.message ?? '';

    return (
        <List sx={{ pt: 0 }}>
            {/* Download storage type */}
            <SelectSetting<DownloadStorageType>
                settingName={t`Download storage type`}
                value={storageType}
                values={DOWNLOAD_STORAGE_TYPE_SELECT_VALUES}
                handleChange={(type) => updateSetting('downloadStorageType', type)}
            />

            {/* WebDAV selected without a URL — the server falls back to local storage until it is set */}
            {storageType === DownloadStorageType.Webdav && !downloadSettings.webdavUrl && (
                <ListItem>
                    <Typography variant="body2" color="warning.main">
                        {t`Set the WebDAV URL to use WebDAV storage. Until then, downloads are stored locally.`}
                    </Typography>
                </ListItem>
            )}

            {/* WebDAV config fields — only when WEBDAV selected */}
            {storageType === DownloadStorageType.Webdav && (
                <>
                    <TextSetting
                        settingName={t`WebDAV URL`}
                        dialogDescription={t`The full URL of the WebDAV server (e.g. http://192.168.1.100:5005)`}
                        value={downloadSettings.webdavUrl ?? ''}
                        settingDescription={downloadSettings.webdavUrl || t`Not set`}
                        handleChange={(url) => updateSetting('webdavUrl', url)}
                    />
                    <TextSetting
                        settingName={t`Username`}
                        dialogDescription={t`WebDAV username (leave blank if no authentication required)`}
                        value={downloadSettings.webdavUsername ?? ''}
                        settingDescription={downloadSettings.webdavUsername || t`Not set`}
                        handleChange={(u) => updateSetting('webdavUsername', u)}
                    />
                    <TextSetting
                        settingName={t`Password`}
                        dialogDescription={t`WebDAV password`}
                        value={downloadSettings.webdavPassword ?? ''}
                        settingDescription={
                            downloadSettings.webdavPassword ? '••••••••' : t`Not set`
                        }
                        handleChange={(p) => updateSetting('webdavPassword', p)}
                    />
                    <TextSetting
                        settingName={t`Remote path`}
                        dialogDescription={t`Remote directory path on the WebDAV server (e.g. manga)`}
                        value={downloadSettings.webdavRemotePath ?? ''}
                        settingDescription={downloadSettings.webdavRemotePath || t`Root`}
                        handleChange={(p) => updateSetting('webdavRemotePath', p)}
                    />

                    {/* Test connection button */}
                    <ListItem>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                            <Button
                                variant="outlined"
                                color={testStatus === 'success' ? 'success' : testStatus === 'error' ? 'error' : 'primary'}
                                onClick={handleTestConnection}
                                disabled={testLoading || !downloadSettings.webdavUrl}
                            >
                                {testLoading ? (
                                    <CircularProgress size={20} />
                                ) : testStatus === 'success' ? (
                                    t`Connection successful`
                                ) : testStatus === 'error' ? (
                                    t`Connection failed`
                                ) : (
                                    t`Test connection`
                                )}
                            </Button>
                            {testMessage && (
                                <Typography
                                    variant="body2"
                                    color={testStatus === 'success' ? 'success.main' : 'error.main'}
                                    sx={{ flex: 1 }}
                                >
                                    {testMessage}
                                </Typography>
                            )}
                        </Box>
                    </ListItem>
                </>
            )}

            {/* Download location — only meaningful for local storage */}
            {storageType === DownloadStorageType.Local && (
                <TextSetting
                    settingName={t`Download location`}
                    dialogDescription={t`The path to the directory on the server where downloaded files should get saved in`}
                    value={downloadSettings?.downloadsPath}
                    settingDescription={
                        downloadSettings?.downloadsPath.length ? downloadSettings.downloadsPath : t`Default`
                    }
                    handleChange={(path) => updateSetting('downloadsPath', path)}
                />
            )}
            <ListItem>
                <ListItemText primary={t`Save as CBZ archive`} />
                <Switch
                    edge="end"
                    checked={!!downloadSettings?.downloadAsCbz}
                    onChange={(e) => updateSetting('downloadAsCbz', e.target.checked)}
                />
            </ListItem>
            <ListItemLink to={AppRoutes.settings.children.images.children.processingDownloads.path}>
                <ListItemText primary={t`Image download processing`} />
            </ListItemLink>
            <List
                subheader={
                    <ListSubheader component="div" id="download-settings-auto-delete-downloads">
                        {t`Delete chapters`}
                    </ListSubheader>
                }
            >
                <ListItem>
                    <ListItemText primary={t`Delete chapter after manually marking it as read`} />
                    <Switch
                        edge="end"
                        checked={metadataSettings.deleteChaptersManuallyMarkedRead}
                        onChange={(e) => updateMetadataSetting('deleteChaptersManuallyMarkedRead', e.target.checked)}
                    />
                </ListItem>
                <DeleteChaptersWhileReadingSetting
                    chapterToDelete={metadataSettings.deleteChaptersWhileReading}
                    handleChange={(chapterToDelete) =>
                        updateMetadataSetting('deleteChaptersWhileReading', chapterToDelete)
                    }
                />
                <ListItem>
                    <ListItemText primary={t`Allow deleting bookmarked chapters`} />
                    <Switch
                        edge="end"
                        checked={metadataSettings.deleteChaptersWithBookmark}
                        onChange={(e) => updateMetadataSetting('deleteChaptersWithBookmark', e.target.checked)}
                    />
                </ListItem>
            </List>
            <List
                subheader={
                    <ListSubheader component="div" id="download-settings-auto-download">
                        {t`Auto-download`}
                    </ListSubheader>
                }
            >
                <ListItem>
                    <ListItemText primary={t`Download new chapters`} />
                    <Switch
                        edge="end"
                        checked={!!downloadSettings?.autoDownloadNewChapters}
                        onChange={(e) => updateSetting('autoDownloadNewChapters', e.target.checked)}
                    />
                </ListItem>
                <NumberSetting
                    disabled={!downloadSettings?.autoDownloadNewChapters}
                    settingTitle={t`Chapter download limit`}
                    dialogDescription={t`Limit the amount of new chapters that are going to get downloaded.`}
                    value={downloadSettings?.autoDownloadNewChaptersLimit ?? 0}
                    settingValue={
                        !downloadSettings.autoDownloadNewChaptersLimit
                            ? t`None`
                            : plural(downloadSettings.autoDownloadNewChaptersLimit, {
                                  one: '# Chapter',
                                  other: '# Chapters',
                              })
                    }
                    defaultValue={0}
                    minValue={0}
                    maxValue={20}
                    showSlider
                    valueUnit={t`Chapter`}
                    handleUpdate={(autoDownloadNewChaptersLimit) =>
                        updateSetting('autoDownloadNewChaptersLimit', autoDownloadNewChaptersLimit)
                    }
                />
                <ListItem>
                    <ListItemText primary={t`Ignore automatic chapter downloads for entries with unread chapters`} />
                    <Switch
                        edge="end"
                        checked={!!downloadSettings?.excludeEntryWithUnreadChapters}
                        onChange={(e) => updateSetting('excludeEntryWithUnreadChapters', e.target.checked)}
                        disabled={!downloadSettings?.autoDownloadNewChapters}
                    />
                </ListItem>
                <ListItem>
                    <ListItemText primary={t`Ignore re-uploaded chapters`} />
                    <Switch
                        edge="end"
                        checked={!!downloadSettings?.autoDownloadIgnoreReUploads}
                        onChange={(e) => updateSetting('autoDownloadIgnoreReUploads', e.target.checked)}
                        disabled={!downloadSettings?.autoDownloadNewChapters}
                    />
                </ListItem>
                <CategoriesInclusionSetting
                    categories={categories.data!.categories.nodes}
                    includeField="includeInDownload"
                    dialogText={t`Entries in excluded categories will not be downloaded even if they are also in included categories`}
                />
            </List>
            <List
                subheader={
                    <ListSubheader component="div" id="download-settings-download-ahead">
                        {t`Download ahead`}
                    </ListSubheader>
                }
            >
                <DownloadAheadSetting downloadAheadLimit={metadataSettings.downloadAheadLimit} />
            </List>
        </List>
    );
};